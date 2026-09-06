import type { AiPaycheckReportDto } from '@/app/api/agent/paycheck/route';
import { QUESTION_LANGUAGE, type UiLocale } from '@/i18n/dict';
import type { PayFinding } from '@/lib/paycycle/types';
import {
  chatAssistantApi,
  explainPaycheckApi,
  translateAiApi,
} from '@/services/api';

export type { AiPaycheckReportDto };

/** 사업주 질문카드 번역 */
export async function translateForEmployer(
  korean: string,
  locale: UiLocale,
): Promise<{ text: string; mock: boolean }> {
  if (locale === 'ko') return { text: korean, mock: false };
  try {
    const result = await translateAiApi({
      korean,
      targetLanguage: QUESTION_LANGUAGE[locale],
    });
    if (result.ok && result.text)
      return { text: result.text, mock: result.mock };
  } catch {
    /* 아래 대체 문구 사용 */
  }
  return {
    text: '번역을 불러오지 못했습니다. 위의 한국어 문장을 그대로 전달해 주세요.',
    mock: true,
  };
}

/** AI Agent 급여 대조 심층 진단 분석 요청 (백엔드 POST /api/paychecks/{paycheckId}/explain 연동) */
export async function fetchAiPaycheckAnalysis(payload: {
  paycheckId: number | string;
  finding: PayFinding;
  period: string;
  workplace?: string;
  locale: UiLocale;
}): Promise<{ ok: boolean; isMock: boolean; data: AiPaycheckReportDto }> {
  const numericId =
    typeof payload.paycheckId === 'number'
      ? payload.paycheckId
      : Number(String(payload.paycheckId).replace(/[^0-9]/g, '')) || 1;

  try {
    // 1. Spring Boot 백엔드 POST /api/paychecks/{paycheckId}/explain 호출
    const backendRes = await explainPaycheckApi(numericId, {
      locale: payload.locale,
      workplace: payload.workplace,
      finding: payload.finding,
      period: payload.period,
    });

    if (backendRes?.data && !backendRes.isMock) {
      const d = backendRes.data;
      const firstCard = d.employerQuestionCards?.[0];
      const localFallback = generateLocalAiPaycheckAnalysis(payload);
      const isNotKorean = payload.locale !== 'ko';
      const containsKorean = (s?: string) => /[가-힣]/.test(s || '');

      const headline =
        isNotKorean && containsKorean(d.headline)
          ? localFallback.data.headline
          : (d.headline || localFallback.data.headline);

      const summary =
        isNotKorean && containsKorean(d.summary)
          ? localFallback.data.summary
          : (d.summary || localFallback.data.summary);

      const documentCheckGuide =
        isNotKorean && containsKorean(d.documentCheckGuide)
          ? localFallback.data.documentCheckGuide
          : (d.documentCheckGuide || localFallback.data.documentCheckGuide);

      const causes =
        d.reasons && d.reasons.length > 0 && !(isNotKorean && containsKorean(d.reasons[0]))
          ? d.reasons.map((r, i) => {
              const titlePart = r.includes('(') ? r.split('(')[0].trim() : r.split(':')[0].trim();
              return {
                title: titlePart || `원인 항목 ${i + 1}`,
                description: r,
                category: (r.includes('공제') || r.toLowerCase().includes('deduction') || r.toLowerCase().includes('khấu trừ'))
                  ? ('DEDUCTION' as const)
                  : (r.includes('수당') || r.toLowerCase().includes('allowance') || r.toLowerCase().includes('phụ cấp'))
                  ? ('ALLOWANCE' as const)
                  : getCategoryFromFinding(payload.finding),
              };
            })
          : localFallback.data.causes;

      const requiredEvidence =
        d.requiredEvidence && d.requiredEvidence.length > 0 && !(isNotKorean && containsKorean(d.requiredEvidence[0]))
          ? d.requiredEvidence
          : localFallback.data.requiredEvidence;

      const nextActions =
        d.nextActions && d.nextActions.length > 0 && !(isNotKorean && containsKorean(d.nextActions[0]))
          ? d.nextActions.map((act, i) => {
              const colonIdx = act.indexOf(':');
              const title = colonIdx !== -1 ? act.slice(0, colonIdx).trim() : `${i + 1}단계`;
              const action = colonIdx !== -1 ? act.slice(colonIdx + 1).trim() : act;
              return {
                step: i + 1,
                title,
                action,
                urgency: i === 0 ? ('HIGH' as const) : i === 1 ? ('HIGH' as const) : ('MEDIUM' as const),
              };
            })
          : localFallback.data.nextActions;

      return {
        ok: true,
        isMock: false,
        data: {
          headline,
          summary,
          documentCheckGuide,
          causes,
          legalBasis: localFallback.data.legalBasis,
          requiredEvidence,
          nextActions,
          messageForEmployer: {
            korean: (() => {
              const rawKorean = firstCard?.koreanScript?.trim();
              if (
                !rawKorean ||
                rawKorean.length < 35 ||
                rawKorean === '급여 차이에 대한 문의' ||
                rawKorean === '급여 차액에 대한 문의' ||
                rawKorean === '급여 차액 확인 요청' ||
                (rawKorean.startsWith('급여 차이') && rawKorean.length < 30)
              ) {
                return localFallback.data.messageForEmployer.korean;
              }
              return rawKorean;
            })(),
            translated: (() => {
              const rawNative = firstCard?.nativeScript?.trim();
              const rawKorean = firstCard?.koreanScript?.trim();
              const isKoreanShort = !rawKorean || rawKorean.length < 35 || rawKorean.includes('급여 차이에 대한 문의');
              if (
                !rawNative ||
                rawNative.length < 35 ||
                rawNative === 'I would like to inquire about the discrepancy in my salary.' ||
                (isNotKorean && (containsKorean(rawNative) || rawNative === rawKorean)) ||
                isKoreanShort
              ) {
                return localFallback.data.messageForEmployer.translated;
              }
              return rawNative;
            })(),
            language: firstCard?.language || payload.locale,
          },
        },
      };
    }
  } catch (err) {
    console.warn('Backend explainPaycheckApi error:', err);
  }

  // 2. Next.js 내부 route 또는 로컬 엔진 Fallback
  try {
    const res = await fetch('/api/agent/paycheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.data) {
        const rawKor = json.data.messageForEmployer?.korean?.trim();
        const rawTrans = json.data.messageForEmployer?.translated?.trim();
        const isKorInsufficient =
          !rawKor ||
          rawKor.length < 35 ||
          rawKor === '급여 차이에 대한 문의' ||
          rawKor === '급여 차액에 대한 문의' ||
          (rawKor.startsWith('급여 차이') && rawKor.length < 30);

        if (isKorInsufficient) {
          const local = generateLocalAiPaycheckAnalysis(payload);
          if (local?.data?.messageForEmployer) {
            json.data.messageForEmployer.korean = local.data.messageForEmployer.korean;
            if (payload.locale !== 'ko') {
              json.data.messageForEmployer.translated = local.data.messageForEmployer.translated;
            }
          }
        } else if (
          payload.locale !== 'ko' &&
          (!rawTrans ||
            /[가-힣]/.test(rawTrans) ||
            rawTrans === rawKor ||
            rawTrans.length < 35 ||
            rawTrans === 'I would like to inquire about the discrepancy in my salary.')
        ) {
          const local = generateLocalAiPaycheckAnalysis(payload);
          if (local?.data?.messageForEmployer) {
            json.data.messageForEmployer.translated = local.data.messageForEmployer.translated;
          }
        }
        return json;
      }
    }
  } catch {
    /* fallback */
  }

  return generateLocalAiPaycheckAnalysis(payload);
}

function getCategoryFromFinding(
  finding: PayFinding,
): 'BASE_PAY' | 'DEDUCTION' | 'NET_PAY' | 'ALLOWANCE' | 'DELAY' | 'UNKNOWN' {
  if (finding.id === 'base' || finding.id === 'minwage') return 'BASE_PAY';
  if (finding.id === 'deduction') return 'DEDUCTION';
  if (finding.id === 'paydate') return 'DELAY';
  if (finding.id === 'net' || finding.id === 'contract-deposit')
    return 'NET_PAY';
  return 'UNKNOWN';
}

function buildEmployerMessage(
  finding: PayFinding,
  period: string,
  locale: UiLocale,
): { korean: string; translated: string } {
  const absDiff = finding.difference ? Math.abs(finding.difference) : 0;
  const diffWon = absDiff > 0 ? `${absDiff.toLocaleString('ko-KR')}원` : '';
  const diffVi = absDiff > 0 ? `${absDiff.toLocaleString('vi-VN')} won` : '';
  const diffEn = absDiff > 0 ? `${absDiff.toLocaleString('en-US')} KRW` : '';
  const diffZh = absDiff > 0 ? `${absDiff.toLocaleString('zh-CN')} 韩元` : '';

  let korean = '';
  let translatedVi = '';
  let translatedZh = '';
  let translatedEn = '';

  if (finding.status === 'INSUFFICIENT_DATA') {
    korean = `안녕하세요 사장님, 이번 달에도 급여 입금해 주셔서 진심으로 감사드립니다. 다름이 아니라 급여 지급 항목과 공제 내역을 정확히 확인하고자 하오니, 근로기준법 제48조에 따른 ${period || '이번 달'} 임금명세서 서류를 교부해 주실 수 있으실까요? 바쁘신 중에 번거롭게 해드려 죄송하며, 편하신 시간에 전달해 주시면 감사하겠습니다. 늘 감사드립니다!`;
    translatedVi = `Xin chào giám đốc, em xin cảm ơn giám đốc đã chuyển lương tháng ${period || 'này'} cho em. Để đối chiếu rõ các mục lương và khoản khấu trừ theo Điều 48 Luật Tiêu chuẩn Lao động, giám đốc cho em xin bản sao phiếu lương tháng ${period || 'này'} được không ạ? Khi nào tiện nhờ giám đốc gửi giúp em với ạ. Em xin cảm ơn!`;
    translatedZh = `老板您好，感谢您发放${period || '本月'}工资。为了核对具体的工资构成与扣款项目，请问能否依据劳动基准法第48条向我提供一份${period || '本月'}的工资明细条呢？百忙之中打扰您十分抱歉，方便时请您发我一下，非常感谢！`;
    translatedEn = `Hello sir, thank you very much for sending my salary for ${period || 'this period'}. In order to review the itemized pay components and deductions pursuant to Article 48 of the Labor Standards Act, could you please provide me with a copy of this month's payslip? I apologize for troubling you, and thank you sincerely!`;
  } else if (finding.status === 'MATCH') {
    korean = `안녕하세요 사장님, 항상 따뜻하게 챙겨주시고 배려해 주셔서 진심으로 감사드립니다. ${period || '이번 달'} 급여가 근로계약서 및 임금명세서 실지급액과 일치하게 통장에 정상적으로 잘 입금된 것을 확인했습니다. 앞으로도 성실히 근무하겠습니다. 늘 건강 조심하세요!`;
    translatedVi = `Xin chào giám đốc, em xin chân thành cảm ơn giám đốc đã luôn quan tâm chu đáo. Em đã nhận đủ lương tháng ${period || 'này'} đúng khớp theo hợp đồng và phiếu lương. Em sẽ tiếp tục làm việc chăm chỉ. Chúc giám đốc luôn dồi dào sức khỏe ạ!`;
    translatedZh = `老板您好，非常感谢您一直以来的关照与支持。我已经确认${period || '本月'}工资与合同及明细完全一致，全额到账。今后我也会继续认真努力工作，祝您身体健康，万事如意！`;
    translatedEn = `Hello sir, thank you very much for always taking good care of me. I have confirmed that my salary for ${period || 'this period'} was deposited in full and matches both my labor contract and payslip. I will continue to work hard. Thank you always!`;
  } else {
    // EXPLANATION_REQUIRED / USER_CONFIRMATION
    if (finding.id === 'base') {
      korean = `안녕하세요 사장님, 항상 현장에서 따뜻하게 배려해 주시고 챙겨주셔서 진심으로 감사드립니다. 다름이 아니라 이번 ${period || '이번 달'} 급여 내역을 확인하던 중, 체결한 근로계약서 제4조 상의 기본급과 교부받은 임금명세서 상의 기본급 사이에 약 ${diffWon || '차액'}의 차이가 확인되어 조심스럽게 연락드렸습니다. 혹시 소정근로시간 계산이나 기본급 산정 기준에 변동 사항이 있었는지, 바쁘시겠지만 편하신 시간에 확인해 주실 수 있으실까요? 늘 감사드리며, 항상 건강 유의하시기 바랍니다!`;
      translatedVi = `Xin chào giám đốc, em xin chân thành cảm ơn giám đốc đã luôn quan tâm và giúp đỡ em trong công việc. Khi đối chiếu chi tiết lương tháng ${period || 'này'}, em nhận thấy có khoản chênh lệch${diffVi} giữa mức lương cơ bản ghi trong Điều 4 của Hợp đồng lao động và mức lương cơ bản trên phiếu lương. Không biết có sự thay đổi nào về cách tính giờ làm việc quy định hay tiêu chuẩn lương cơ bản không ạ? Khi nào thuận tiện, nhờ giám đốc kiểm tra lại giúp em với ạ. Em xin cảm ơn rất nhiều!`;
      translatedZh = `老板您好，非常感谢您在工作中一直以来对我的关照与支持。我在核对${period || '本月'}的工资明细时发现，劳动合同第四条约定的基本工资与本月收到的工资条上的基本工资之间存在${diffZh ? `约 ${diffZh}` : '一定'}的差额，因此想向您礼貌地请教一下。想请问是否因法定工作时间核算或基本工资计算标准有所调整呢？百忙之中打扰您十分抱歉，方便时请您帮忙确认一下。非常感谢您的指导与关怀！`;
      translatedEn = `Hello sir, thank you very much for always supporting and guiding me at work. While reviewing my salary details for ${period || 'this period'}, I noticed a difference${diffEn} between the base salary specified in Article 4 of my employment contract and the base salary recorded on my payslip. Could you please check at your convenience whether there was any change to the contractual working hours or the base pay calculation criteria? I apologize for bothering you during your busy schedule, and thank you sincerely!`;
    } else if (finding.id === 'deduction') {
      korean = `안녕하세요 사장님, 평소 따뜻한 가르침과 배려에 항상 감사드립니다. 이번 ${period || '이번 달'} 임금명세서의 공제 내역을 살펴보던 중, 지난달보다 공제 총액이 다소 증가하여 확인차 조심스럽게 연락드렸습니다. 혹시 4대보험 요율 변동, 연말정산 및 소급분 정산, 또는 기숙사비나 식대 등 추가로 공제된 세부 내역이 있는지 설명해 주실 수 있으실까요? 바쁘신 업무 중에 번거롭게 해드려 죄송하며, 시간 되실 때 간략히 알려주시면 감사하겠습니다. 늘 감사드립니다!`;
      translatedVi = `Xin chào giám đốc, em cảm ơn giám đốc đã luôn giúp đỡ. Khi xem các khoản khấu trừ trên phiếu lương tháng ${period || 'này'}, em thấy tổng tiền khấu trừ có tăng so với trước. Nhờ giám đốc giải thích giúp em chi tiết các khoản trừ như bảo hiểm, ký túc xá hay tiền ăn khi thuận tiện ạ. Em xin cảm ơn!`;
      translatedZh = `老板您好，感谢您一直以来的指导与照顾。我在查看${period || '本月'}工资条的扣款明细时，发现扣除金额较以往有所增加。想向您请教一下关于四大保险补缴、住宿或餐费等具体扣款明细。方便时请您帮忙说明一下，谢谢老板！`;
      translatedEn = `Hello sir, thank you for your support. While reviewing the deductions on my payslip for ${period || 'this period'}, I noticed a noticeable increase in deduction items compared to previous months. Could you please explain the specific breakdown regarding insurance adjustments, dormitory, or meal expenses when you have time? Thank you very much!`;
    } else if (finding.id === 'paydate') {
      korean = `안녕하세요 사장님, 항상 챙겨주셔서 감사드립니다. 다름이 아니라 근로계약서 상에 약정된 급여 지급일과 관련하여, 아직 통장에 급여 입금 내역이 확인되지 않아 조심스럽게 여쭈어보고자 연락드렸습니다. 혹시 주말이나 은행 영업일 순연으로 인해 지급 일정이 조정된 것인지, 아니면 제 계좌 정보 등에 확인이 필요한 부분이 있는지 편하신 시간에 알려주시면 감사하겠습니다. 감사합니다!`;
      translatedVi = `Xin chào giám đốc, em cảm ơn giám đốc đã luôn quan tâm. Đã qua ngày trả lương theo hợp đồng nhưng tài khoản của em vẫn chưa nhận được tiền lương tháng ${period || 'này'}. Nhờ giám đốc kiểm tra giúp em xem có điều chỉnh lịch chuyển do ngày nghỉ hay có vướng mắc gì không ạ. Em cảm ơn giám đốc!`;
      translatedZh = `老板您好，非常感谢您的关照。目前已超过合同约定的发薪日，但银行账户尚未查到${period || '本月'}工资到账记录，因此冒昧向您询问一下。请问是否因节假日顺延或转账安排有所变动呢？方便时请您告知一下，谢谢您！`;
      translatedEn = `Hello sir, thank you always for taking care of us. I am politely inquiring because my salary deposit has not yet appeared in my bank account past the agreed payday in my contract. Could you please let me know if there was a schedule change due to bank holidays or transfer delays? Thank you!`;
    } else {
      // net or default
      korean = `안녕하세요 사장님, 이번 달에도 노고 많으셨고 급여 챙겨주셔서 진심으로 감사드립니다. 다름이 아니라 급여 내역을 확인하던 중, 교부받은 임금명세서 상의 실지급액과 실제 제 통장에 입금된 금액 사이에 약 ${diffWon || '차액'}의 차액이 확인되어 조심스럽게 문의드립니다. 혹시 기숙사비나 식대 등 명세서에 기재되지 않은 추가 공제 항목이 있었는지, 아니면 계좌 송금 과정에서 착오가 있었는지 시간 되실 때 확인해 주시면 감사하겠습니다. 바쁘신 업무 중에 번거롭게 해드려 죄송합니다. 늘 배려해 주셔서 감사합니다!`;
      translatedVi = `Xin chào giám đốc, em xin chân thành cảm ơn giám đốc đã vất vả và chuyển lương tháng ${period || 'này'} cho em. Khi kiểm tra tài khoản, em thấy số tiền thực lĩnh ghi trên phiếu lương và số tiền thực tế nhận vào tài khoản ngân hàng có khoản chênh lệch${diffVi}. Không biết công ty có khấu trừ thêm khoản nào ngoài phiếu lương như tiền ký túc xá, tiền ăn, bảo hiểm truy thu hay có nhầm lẫn trong quá trình chuyển khoản không ạ? Khi nào thuận tiện, nhờ giám đốc xem lại giúp em với ạ. Em xin lỗi vì đã làm phiền giám đốc trong lúc bận rộn. Em cảm ơn giám đốc rất nhiều!`;
      translatedZh = `老板您好，辛苦您了，非常感谢您按时发放${period || '本月'}的工资。我在核对实到账目时注意到，工资条上载明的实发金额与我的银行账户实际到账金额之间存在${diffZh ? `约 ${diffZh}` : '一定'}的差额，因此想向您礼貌地咨询一下。想请问是否有未在明细中列出的扣款项目（如宿舍费、餐费、四大保险补扣等），或者是转账过程中出现了小差错？百忙之中给您添麻烦了，方便时请您帮忙查验一下。非常感谢老板一直以来的关照！`;
      translatedEn = `Hello sir, thank you very much for all your hard work and for sending my salary for ${period || 'this period'}. While checking my account, I noticed a discrepancy${diffEn} between the net pay stated on my payslip and the actual amount deposited into my bank account, so I am reaching out politely. Could you please check when you have a moment whether there were additional unlisted deductions—such as dormitory, meal expenses, or retroactive insurance adjustments—or perhaps a minor discrepancy during the bank transfer? I apologize for taking up your time during your busy schedule. Thank you sincerely for your continuous support and care!`;
    }
  }

  let translated = '';
  if (locale === 'vi') translated = translatedVi;
  else if (locale === 'zh') translated = translatedZh;
  else if (locale === 'en') translated = translatedEn;

  return { korean, translated };
}

/** 로컬 룰 엔진 기반 AI 급여 대조 심층 진단 리포트 생성 (PayFinding 확정 사실 기반) */
export function generateLocalAiPaycheckAnalysis(payload: {
  finding: PayFinding;
  period: string;
  workplace?: string;
  locale: UiLocale;
}): { ok: boolean; isMock: boolean; data: AiPaycheckReportDto } {
  const { finding, period, locale } = payload;
  const status = finding.status;
  const diffAmount = finding.difference ? Math.abs(finding.difference) : 0;
  const formatDiff = (amt: number, loc: UiLocale) => {
    if (!amt) return '';
    if (loc === 'vi') return `${amt.toLocaleString('vi-VN')} won`;
    if (loc === 'en') return `${amt.toLocaleString('en-US')} KRW`;
    if (loc === 'zh') return `${amt.toLocaleString('zh-CN')} 韩元`;
    return `${amt.toLocaleString('ko-KR')}원`;
  };
  const diffWon = formatDiff(diffAmount, locale);

  const category = getCategoryFromFinding(finding);
  const { korean, translated } = buildEmployerMessage(finding, period, locale);

  let headline = finding.title;
  let summary = finding.fact || '급여 대조 결과가 확인되었습니다.';
  let documentCheckGuide = '임금명세서와 은행 입금 내역을 대조하여 세부 항목을 확인해보세요.';
  let causes: AiPaycheckReportDto['causes'] = [];
  let legalBasis: AiPaycheckReportDto['legalBasis'] = {
    law: finding.standard || '근로기준법 제43조 (임금 지급의 원칙)',
    description: '임금은 통화로 직접 근로자에게 그 전액을 지급하여야 합니다.',
    protectionNotice:
      '근로자는 임금명세서 세부 내역 및 공제 내역을 확인할 권리가 있습니다.',
  };
  let requiredEvidence: string[] = ['해당 월 임금명세서', '은행 통장 거래내역서', '표준근로계약서'];
  let nextActions: AiPaycheckReportDto['nextActions'] = [
    {
      step: 1,
      title: '1단계: 증빙 확보',
      action: '임금명세서와 통장 거래내역서를 확보하여 보관하세요.',
      urgency: 'HIGH',
    },
    {
      step: 2,
      title: '2단계: 사장님 질문 문의',
      action: '제공된 질문 카드를 복사하여 사장님께 정중히 문의하세요.',
      urgency: 'HIGH',
    },
  ];

  if (locale === 'vi') {
    if (status === 'INSUFFICIENT_DATA') {
      headline = 'Cần kiểm tra giấy tờ để đối chiếu lương';
      summary = 'Chưa đủ tài liệu hoặc dữ liệu để hoàn thành đối chiếu 3 bên. Cần bổ sung tài liệu để kiểm tra.';
      documentCheckGuide = 'Vui lòng đăng ký bản sao phiếu lương tháng này hoặc sao kê ngân hàng để hoàn thành đối chiếu.';
      causes = [
        {
          title: 'Cần bổ sung tài liệu cần thiết',
          description: 'Không thể đối chiếu chính xác do chưa có đầy đủ tài liệu liên quan đến lương.',
          category: 'UNKNOWN',
        },
      ];
      legalBasis = {
        law: 'Điều 48 Luật Tiêu chuẩn Lao động (Nghĩa vụ cấp phiếu lương)',
        description: 'Người sử dụng lao động phải cấp phiếu lương ghi rõ các mục cấu thành và phương pháp tính khi trả lương.',
        protectionNotice: 'Hãy lưu giữ hợp đồng lao động, phiếu lương và sao kê ngân hàng để bảo vệ quyền lợi tài chính.',
      };
      requiredEvidence = ['Phiếu lương tháng tương ứng', 'Sao kê tài khoản ngân hàng', 'Hợp đồng lao động'];
      nextActions = [
        {
          step: 1,
          title: 'Bước 1: Tải lên tài liệu còn thiếu',
          action: 'Chụp ảnh phiếu lương hoặc sao kê giao dịch ngân hàng để tải lên.',
          urgency: 'HIGH',
        },
      ];
    } else if (status === 'MATCH') {
      headline = `Đối chiếu 3 bên tháng ${period || ''} hoàn tất (Bình thường)`;
      summary = 'Lương cơ bản trong hợp đồng, thực nhận trên phiếu lương và tiền vào tài khoản hoàn toàn trùng khớp.';
      documentCheckGuide = 'Khuyến nghị lưu giữ an toàn phiếu lương và lịch sử chuyển khoản trong 3 năm.';
      causes = [
        {
          title: 'Xác nhận trả lương bình thường',
          description: 'Lương đã được trả đúng và đủ theo điều kiện hợp đồng và bảng lương.',
          category: 'NET_PAY',
        },
      ];
      legalBasis = {
        law: 'Điều 43 Luật Tiêu chuẩn Lao động (Nguyên tắc trả lương)',
        description: 'Tiền lương đã được trả đầy đủ và đúng quy định pháp luật cũng như hợp đồng.',
        protectionNotice: 'Lưu giữ phiếu lương rất hữu ích cho việc tính tiền thôi việc và gia hạn visa sau này.',
      };
      requiredEvidence = [`Bản sao phiếu lương tháng ${period || ''}`];
      nextActions = [
        {
          step: 1,
          title: 'Bước 1: Lưu trữ phiếu lương',
          action: 'Lưu trữ file phiếu lương cẩn thận cho các thủ tục hành chính sau này.',
          urgency: 'LOW',
        },
      ];
    } else {
      // EXPLANATION_REQUIRED / USER_CONFIRMATION
      if (finding.id === 'base') {
        headline = `Phát hiện chênh lệch ${diffWon} lương cơ bản ${period || ''}`.trim();
        summary = `Lương cơ bản trên phiếu lương tháng này có chênh lệch ${diffWon} so với hợp đồng lao động đã ký. Cần kiểm tra xem có thay đổi giờ làm việc hoặc thỏa thuận mới hay không.`;
        documentCheckGuide = 'Vui lòng đối chiếu điều khoản lương cơ bản trên hợp đồng lao động với mục lương cơ bản trên phiếu lương để làm rõ nguyên nhân.';
        causes = [
          {
            title: 'Chênh lệch lương cơ bản',
            description: `Hợp đồng và phiếu lương có chênh lệch ${diffWon}. Cần kiểm tra xem có văn bản đồng ý thay đổi lương hay không.`,
            category: 'BASE_PAY',
          },
        ];
        legalBasis = {
          law: 'Điều 17 Luật Tiêu chuẩn Lao động (Ghi rõ điều kiện làm việc)',
          description: 'Tiền lương phải được ghi rõ trong hợp đồng lao động. Nghiêm cấm hạ lương cơ bản mà không có sự đồng ý bằng văn bản.',
          protectionNotice: 'Người lao động có quyền yêu cầu giải thích rõ ràng căn cứ tính lương cơ bản.',
        };
        requiredEvidence = ['Bản gốc hợp đồng lao động', 'Phiếu lương tháng tương ứng', 'Bảng chấm công'];
        nextActions = [
          {
            step: 1,
            title: 'Bước 1: Chụp ảnh lưu bằng chứng',
            action: 'Lưu giữ ảnh chụp hợp đồng và phiếu lương làm cơ sở đối chiếu.',
            urgency: 'HIGH',
          },
          {
            step: 2,
            title: 'Bước 2: Sử dụng thẻ câu hỏi hỏi người sử dụng lao động',
            action: 'Sao chép tin nhắn tiếng Hàn được chuẩn bị sẵn để gửi cho chủ sử dụng hỏi lịch sự.',
            urgency: 'HIGH',
          },
          {
            step: 3,
            title: 'Bước 3: Yêu cầu cấp phiếu lương sửa đổi',
            action: 'Nếu có sai sót nhầm lẫn, yêu cầu thanh toán bổ sung và nhận phiếu lương chỉnh sửa.',
            urgency: 'HIGH',
          },
        ];
      } else if (finding.id === 'deduction') {
        headline = `Tỷ lệ khấu trừ lương tháng ${period || ''} ở mức cao`;
        summary = `Tổng các khoản khấu trừ trên phiếu lương chiếm tỷ lệ đáng kể. Cần kiểm tra xem có khoản khấu trừ nào chưa được thỏa thuận trước hay không.`;
        documentCheckGuide = 'Kiểm tra tỷ lệ 4 loại bảo hiểm xã hội, thuế thu nhập và các khoản khấu trừ khác (ký túc xá, tiền ăn...).';
        causes = [
          {
            title: 'Khấu trừ nhiều mục trên phiếu lương',
            description: 'Khả năng có các khoản trừ tiền ăn, phòng ở hoặc truy thu bảo hiểm chưa có văn bản đồng ý.',
            category: 'DEDUCTION',
          },
        ];
        legalBasis = {
          law: 'Điều 43 Luật Tiêu chuẩn Lao động (Nguyên tắc trả toàn bộ lương)',
          description: 'Tiền lương phải được trả toàn bộ trực tiếp, việc khấu trừ ngoài luật định phải có thỏa thuận văn bản.',
          protectionNotice: 'Bạn có quyền yêu cầu bảng kê chi tiết cho từng khoản khấu trừ cụ thể.',
        };
        requiredEvidence = ['Bảng kê chi tiết các khoản khấu trừ trên phiếu lương', 'Thỏa thuận chi phí sinh hoạt (nếu có)'];
        nextActions = [
          {
            step: 1,
            title: 'Bước 1: Yêu cầu giải thích chi tiết từng khoản trừ',
            action: 'Hỏi người phụ trách tiền lương về công thức tính các khoản khấu trừ.',
            urgency: 'HIGH',
          },
        ];
      } else {
        // net or other
        headline = `Phát hiện chênh lệch ${diffWon} tiền vào tài khoản ${period || ''}`.trim();
        summary = `Số tiền thực tế nhận vào tài khoản ngân hàng thấp hơn ${diffWon} so với số tiền thực lĩnh ghi trên phiếu lương. Cần xác nhận lý do phát sinh chênh lệch.`;
        documentCheckGuide = `Đối chiếu chi tiết các khoản khấu trừ trên phiếu lương với sao kê ngân hàng để làm rõ khoản ${diffWon} chưa rõ.`;
        causes = [
          {
            title: 'Sai lệch giữa phiếu lương và tiền vào tài khoản',
            description: `Có chênh lệch ${diffWon} giữa phiếu lương và sao kê thực nhận. Có thể do lỗi chuyển khoản hoặc khấu trừ thêm.`,
            category: 'NET_PAY',
          },
        ];
        legalBasis = {
          law: 'Điều 43 Luật Tiêu chuẩn Lao động (Nguyên tắc trả lương đầy đủ)',
          description: 'Số tiền thực lĩnh trên phiếu lương phải được chuyển đầy đủ vào tài khoản ngân hàng của người lao động.',
          protectionNotice: 'Bạn có quyền yêu cầu chuyển bù ngay số tiền còn thiếu nếu do nhầm lẫn.',
        };
        requiredEvidence = ['Phiếu lương tháng tương ứng', 'Sao kê tài khoản ngân hàng (có tên người gửi)'];
        nextActions = [
          {
            step: 1,
            title: 'Bước 1: Lưu giữ phiếu lương và sao kê ngân hàng',
            action: 'Chụp ảnh hoặc in sao kê ngân hàng làm bằng chứng.',
            urgency: 'HIGH',
          },
          {
            step: 2,
            title: 'Bước 2: Gửi thẻ câu hỏi cho chủ sử dụng lao động',
            action: 'Dùng thẻ câu hỏi tiếng Hàn hỏi lịch sự về lý do chênh lệch tiền gửi.',
            urgency: 'HIGH',
          },
        ];
      }
    }
  } else if (locale === 'en') {
    if (status === 'INSUFFICIENT_DATA') {
      headline = 'Document verification needed for paycheck check';
      summary = 'Not enough documents or data to complete the 3-way check. Additional documents are needed.';
      documentCheckGuide = 'Please upload a payslip or bank statement for this month to complete the comparison.';
      causes = [
        {
          title: 'Missing required documents',
          description: 'Cannot perform precision comparison due to unverified pay documents.',
          category: 'UNKNOWN',
        },
      ];
      legalBasis = {
        law: 'Article 48 of the Labor Standards Act (Duty to Deliver Payslips)',
        description: 'Employers must provide a payslip itemizing wage components and calculation methods upon payment.',
        protectionNotice: 'Keep employment contracts, payslips, and bank statements to protect your financial rights.',
      };
      requiredEvidence = ['Payslip for corresponding month', 'Bank statement', 'Employment contract'];
      nextActions = [
        {
          step: 1,
          title: 'Step 1: Upload missing documents',
          action: 'Upload your payslip image or enter your bank deposit details.',
          urgency: 'HIGH',
        },
      ];
    } else if (status === 'MATCH') {
      headline = `3-Way Match Verified for ${period || 'this month'}`;
      summary = 'The contract base salary, payslip net pay, and bank deposit amount match completely.';
      documentCheckGuide = 'It is recommended to safely store payslips and bank transaction records for 3 years.';
      causes = [
        {
          title: 'Normal Payment Verified',
          description: 'Payment was made accurately in accordance with contractual terms and payslip items.',
          category: 'NET_PAY',
        },
      ];
      legalBasis = {
        law: 'Article 43 of the Labor Standards Act (Principle of Wage Payment)',
        description: 'Wages have been paid in full directly in currency pursuant to law and agreement.',
        protectionNotice: 'Retaining payslips is essential for future severance calculation and visa extension.',
      };
      requiredEvidence = [`Copy of ${period || 'this month'} payslip`];
      nextActions = [
        {
          step: 1,
          title: 'Step 1: Keep record',
          action: 'Safely store payslip file for visa and tax administration.',
          urgency: 'LOW',
        },
      ];
    } else {
      if (finding.id === 'base') {
        headline = `Base salary difference of ${diffWon} detected for ${period || ''}`.trim();
        summary = `A difference of ${diffWon} was found between the base pay in your contract and your payslip for this month. Please check for any working hour adjustments or renewed contracts.`;
        documentCheckGuide = 'Compare Article 4 (Wage) of your employment contract with the base pay item on your payslip.';
        causes = [
          {
            title: 'Base Pay Discrepancy',
            description: `Discrepancy of ${diffWon} between contractual base pay and payslip base pay.`,
            category: 'BASE_PAY',
          },
        ];
        legalBasis = {
          law: 'Article 17 of the Labor Standards Act (Clear Specification of Working Conditions)',
          description: 'Wages must be clearly specified in writing in the contract. Reductions without written consent are restricted.',
          protectionNotice: 'Workers have the right to request a clear calculation basis for their base pay.',
        };
        requiredEvidence = ['Original employment contract', 'Monthly payslip', 'Attendance record'];
        nextActions = [
          {
            step: 1,
            title: 'Step 1: Save evidence',
            action: 'Save copies of your contract and payslip as evidence.',
            urgency: 'HIGH',
          },
          {
            step: 2,
            title: 'Step 2: Use Employer Question Card',
            action: 'Copy the Korean question script to inquire politely about the difference.',
            urgency: 'HIGH',
          },
        ];
      } else {
        headline = `Deposit shortage of ${diffWon} detected for ${period || ''}`.trim();
        summary = `The actual amount deposited into your bank account is ${diffWon} lower than the net pay on your payslip. Please verify any unlisted deductions.`;
        documentCheckGuide = `Compare the deduction items on your payslip with your bank statement for the ${diffWon} difference.`;
        causes = [
          {
            title: 'Discrepancy between Payslip and Bank Deposit',
            description: `A ${diffWon} shortage between payslip net amount and actual deposit.`,
            category: 'NET_PAY',
          },
        ];
        legalBasis = {
          law: 'Article 43 of the Labor Standards Act (Principle of Full Payment)',
          description: 'The net pay stated on the payslip must be transferred in full to the employee bank account.',
          protectionNotice: 'You have the right to receive immediate reimbursement if there was a calculation mistake.',
        };
        requiredEvidence = ['Monthly payslip', 'Bank transaction statement'];
        nextActions = [
          {
            step: 1,
            title: 'Step 1: Save evidence',
            action: 'Keep screenshots of payslip and bank transactions.',
            urgency: 'HIGH',
          },
          {
            step: 2,
            title: 'Step 2: Inquire with employer',
            action: 'Use the employer question card to inquire politely about the deposit difference.',
            urgency: 'HIGH',
          },
        ];
      }
    }
  } else {
    // ko 기본
    if (status === 'INSUFFICIENT_DATA') {
      headline = finding.title || '급여 대조를 위한 자료 확인 필요';
      summary =
        finding.fact ||
        '대조를 완료하기 위한 서류나 데이터가 충분하지 않아 추가 확인이 필요합니다.';
      causes = [
        {
          title: finding.title || '필수 서류 확인 필요',
          description:
            finding.limitation ||
            finding.fact ||
            '필요한 급여 관련 서류가 확인되지 않아 정밀 대조를 진행할 수 없습니다.',
          category: 'UNKNOWN',
        },
      ];
      legalBasis = {
        law: finding.standard || '근로기준법 제48조 (임금명세서 교부 의무)',
        description: finding.standard
          ? `${finding.standard} 기준에 따라 서류 및 내역 확인이 필요합니다.`
          : '사용자는 임금을 지급할 때 임금의 구성항목 및 계산방법 등이 적힌 임금명세서를 교부하여야 합니다.',
        protectionNotice:
          '정확한 금융권리 확인을 위해 근로계약서, 임금명세서, 통장 거래내역서를 확보하여 보관하세요.',
      };
      documentCheckGuide = '이번 달 교부받은 임금명세서 사본이나 통장 거래내역서를 등록하여 3중 대조를 완료해보세요.';
    } else if (status === 'MATCH') {
      headline = finding.title || `${period || '해당 월'} 급여 3중 대조 완료`;
      summary =
        finding.fact || '근로계약서, 임금명세서, 통장 실입금액이 일치합니다.';
      causes = [
        {
          title: '정상 지급 확인',
          description:
            finding.fact ||
            '계약 조건 및 임금명세서 기준과 일치하여 정상 지급되었습니다.',
          category: 'NET_PAY',
        },
      ];
      legalBasis = {
        law: finding.standard || '근로기준법 제43조 (임금 지급의 원칙)',
        description: '임금이 법령과 계약 조건에 맞추어 전액 정상 지급되었습니다.',
        protectionNotice:
          '교부받은 임금명세서와 은행 입금 내역은 3년간 안전하게 보관하시는 것을 권장합니다.',
      };
      documentCheckGuide = '교부받은 임금명세서와 은행 입금 내역은 3년간 안전하게 보관하시는 것을 권장합니다.';
    } else {
      headline = finding.title;
      summary = finding.fact;
      causes = [
        {
          title: finding.title,
          description: `${finding.fact}${
            finding.limitation ? ` (확인 범위: ${finding.limitation})` : ''
          }`,
          category,
        },
      ];
      const stdRaw = (finding.standard || '근로기준법').trim().replace(/\.+$/, '');
      legalBasis = {
        law: finding.standard || '근로기준법',
        description: finding.limitation
          ? `판단 기준: ${stdRaw}. (${finding.limitation})`
          : `${stdRaw}.`,
        protectionNotice:
          '공제 내역이나 차액에 대해 사업주에게 서면 내역 교부를 요청하여 확인할 법적 권리가 있습니다.',
      };

      if (finding.id === 'base') {
        documentCheckGuide = '근로계약서 제4조(기본급) 조항과 임금명세서의 기본급 항목을 대조해보세요. 계약서보다 적게 산정되었다면 변경 동의서 체결 여부나 일할 계산 여부를 사업장에 확인해야 합니다.';
      } else if (finding.id === 'net' || finding.id === 'contract-deposit') {
        documentCheckGuide = `임금명세서의 '공제 내역(4대보험 소급 정산, 숙소비, 식대 등)'과 실제 통장 입금 거래내역서를 대조해보세요. 명세서에 기재되지 않은 ${diffWon || '차액'}의 추가 공제가 있었는지 급여 담당자에게 확인해야 합니다.`;
      } else if (finding.id === 'deduction') {
        documentCheckGuide = '임금명세서의 4대보험(국민연금, 건강보험, 고용보험) 및 소득세 공제율과 기타 공제(기숙사비, 식대 등) 항목을 확인해보세요. 사전 서면 동의 없는 공제 항목이 있는지 점검이 필요합니다.';
      } else if (finding.id === 'paydate') {
        documentCheckGuide = '근로계약서에 명시된 임금 지급일과 실제 통장 입금 일시를 대조해보세요. 주말이나 공휴일로 인해 은행 영업일로 순연된 것인지 사업장에 확인해보세요.';
      }
    }
  }

  if (finding.requiredEvidence && finding.requiredEvidence.length > 0 && locale === 'ko') {
    requiredEvidence = finding.requiredEvidence;
  }
  if (finding.nextActions && finding.nextActions.length > 0 && locale === 'ko') {
    nextActions = finding.nextActions.map((action, idx) => ({
      step: idx + 1,
      title: action,
      action,
      urgency: idx === 0 ? ('HIGH' as const) : idx === 1 ? ('HIGH' as const) : ('MEDIUM' as const),
    }));
  }

  return {
    ok: true,
    isMock: true,
    data: {
      headline,
      summary,
      documentCheckGuide,
      causes,
      legalBasis,
      requiredEvidence,
      nextActions,
      messageForEmployer: {
        korean,
        translated,
        language: locale,
      },
    },
  };
}

/**
 * AI 어시스턴트 질문. /api/agent/chat 에 LLM API 키가 설정돼 있으면 실제 답변을 받고,
 * 키가 없거나 호출이 실패하면 text: null 을 반환해 호출부(chat-dock)가 localAnswer()
 * 규칙 엔진으로 자연스럽게 폴백하도록 한다.
 */
export async function askAssistant(
  question: string,
  context: string,
  locale: UiLocale,
): Promise<{ text: string | null; error: string | null }> {
  // 1. Spring Boot 백엔드 POST /api/agent/chat 연동 (서버가 직접 사용자 데이터로 컨텍스트 구성)
  try {
    const backendRes = await chatAssistantApi(question, locale);
    if (!backendRes.isMock && backendRes.data.ok && backendRes.data.text) {
      return { text: backendRes.data.text, error: null };
    }
  } catch {
    /* 아래 Next.js 내부 route로 폴백 */
  }

  // 2. Next.js 내부 route(Gemini) 또는 로컬 규칙 엔진 Fallback
  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, locale }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { text: null, error: null };
    const json = await res.json();
    return { text: json.ok && json.text ? json.text : null, error: null };
  } catch {
    return { text: null, error: null };
  }
}
