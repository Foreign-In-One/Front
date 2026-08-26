import { translateAiApi } from "@/services/api";
import { QUESTION_LANGUAGE, type UiLocale } from "@/i18n/dict";
import type { AiPaycheckReportDto } from "@/app/api/agent/paycheck/route";
import type { PayFinding } from "@/lib/paycycle/types";

export type { AiPaycheckReportDto };

/** 사업주 질문카드 번역 */
export async function translateForEmployer(
  korean: string,
  locale: UiLocale,
): Promise<{ text: string; mock: boolean }> {
  if (locale === "ko") return { text: korean, mock: false };
  try {
    const result = await translateAiApi({
      korean,
      targetLanguage: QUESTION_LANGUAGE[locale],
    });
    if (result.ok && result.text) return { text: result.text, mock: result.mock };
  } catch {
    /* 아래 대체 문구 사용 */
  }
  return {
    text: "번역을 불러오지 못했습니다. 위의 한국어 문장을 그대로 전달해 주세요.",
    mock: true,
  };
}

/** AI Agent 급여 대조 심층 진단 분석 요청 */
export async function fetchAiPaycheckAnalysis(payload: {
  paycheckId: number | string;
  finding: PayFinding;
  period: string;
  workplace?: string;
  locale: UiLocale;
}): Promise<{ ok: boolean; isMock: boolean; data: AiPaycheckReportDto }> {
  try {
    const res = await fetch("/api/agent/paycheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.data) {
        return json;
      }
    }
  } catch (err) {
    console.warn("fetchAiPaycheckAnalysis error:", err);
  }

  // Fallback
  const diffWon = Math.abs(payload.finding.difference).toLocaleString("ko-KR") + "원";
  const loc = payload.locale;

  if (loc === "vi") {
    return {
      ok: true,
      isMock: true,
      data: {
        headline: `Phân tích chênh lệch ${diffWon} giữa thực tế nhận và phiếu lương`,
        summary: `Phát hiện khoản chênh lệch ${diffWon} giữa số tiền thực lĩnh trên phiếu lương và số tiền thực tế chuyển vào tài khoản. Cần xác minh xem có khoản khấu trừ chưa ghi hoặc phân chia thanh toán hay không.`,
        causes: [
          {
            title: "Khả năng khấu trừ chưa được liệt kê",
            description: "Các khoản như tiền nhà, tiền ăn, đồng phục chưa có thỏa thuận văn bản có thể đã bị trừ trước khi chuyển khoản.",
            category: "DEDUCTION",
          },
          {
            title: "Sai lệch tính toán thực lĩnh",
            description: "Có thể do nhầm lẫn khi chuyển khoản hoặc thiếu sót tính toán phụ cấp làm thêm giờ/chuyên cần.",
            category: "NET_PAY",
          },
        ],
        legalBasis: {
          law: "Điều 43 Luật Tiêu chuẩn Lao động (Nguyên tắc trả lương)",
          description: "Tiền lương phải được trả trực tiếp, đầy đủ bằng tiền tệ vào ngày cố định hàng tháng. Nghiêm cấm tự ý khấu trừ lương khi chưa có quy định pháp luật.",
          protectionNotice: "Bạn có quyền yêu cầu người sử dụng lao động cung cấp bảng kê chi tiết cho bất kỳ khoản khấu trừ nào không ghi trên phiếu lương.",
        },
        requiredEvidence: ["Phiếu lương tháng tương ứng", "Sao kê/Lịch sử giao dịch ngân hàng", "Bản sao hợp đồng lao động"],
        nextActions: [
          {
            step: 1,
            title: "Hỏi người sử dụng lao động về lý do chênh lệch",
            action: "Sao chép thẻ câu hỏi được cung cấp để nhắn tin lịch sự hỏi căn cứ tính lương.",
            urgency: "HIGH",
          },
          {
            step: 2,
            title: "Nhận phiếu lương sửa đổi",
            action: "Yêu cầu và lưu giữ phiếu lương có ghi rõ từng khoản khấu trừ cụ thể.",
            urgency: "MEDIUM",
          },
          {
            step: 3,
            title: "Liên hệ Trung tâm hỗ trợ lao động nước ngoài",
            action: "Nếu không được giải quyết thỏa đáng, bạn có thể gọi 1350 để được tư vấn bảo vệ quyền lợi.",
            urgency: "LOW",
          },
        ],
        messageForEmployer: {
          korean: `안녕하세요 사장님, 이번 달 급여 중 임금명세서 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이 있는지 확인 부탁드립니다. 감사합니다.`,
          translated: `Xin chào anh/chị, tôi thấy có sự chênh lệch khoảng ${diffWon} giữa số tiền thực lĩnh trên phiếu lương và số tiền thực tế nhận vào tài khoản. Nhờ anh/chị kiểm tra giúp tôi xem có khoản khấu trừ nào bổ sung không ạ. Tôi xin cảm ơn!`,
          language: loc,
        },
      },
    };
  }

  if (loc === "zh") {
    return {
      ok: true,
      isMock: true,
      data: {
        headline: `实际到账金额与工资明细相差 ${diffWon} 的分析`,
        summary: `工资明细上的实发金额与银行账户实际到账金额之间存在 ${diffWon} 的差异。需要核实是否存在未注明的扣除项目或分批发放情况。`,
        causes: [
          {
            title: "可能存在未列明的扣款项目",
            description: "住宿费、伙食费、工服费等未经书面同意的额外费用可能在到账前被扣除。",
            category: "DEDUCTION",
          },
          {
            title: "实发金额核算偏差",
            description: "可能存在转账操作失误或加班/周休津贴差额核算遗漏。",
            category: "NET_PAY",
          },
        ],
        legalBasis: {
          law: "韩国劳动标准法第43条（工资支付原则）",
          description: "工资必须在每月固定的日期以货币形式全额直接支付给劳动者。除法律规定外严禁随意扣除。",
          protectionNotice: "对于明细中未注明的扣款差额，您有权要求雇主提供书面明细说明。",
        },
        requiredEvidence: ["当月工资明细副本", "银行交易明细凭证", "标准劳动合同副本"],
        nextActions: [
          {
            step: 1,
            title: "向雇主或财务询问差额原因",
            action: "复制系统提供的提问卡，礼貌地向雇主询问计算依据。",
            urgency: "HIGH",
          },
          {
            step: 2,
            title: "获取注明详细扣除项的修正明细",
            action: "索取并妥善保管列明各项扣款金额的工资明细。",
            urgency: "MEDIUM",
          },
          {
            step: 3,
            title: "联系外国劳动者支援中心或劳动厅",
            action: "若无正当理由且未能解决，可拨打1350向雇佣劳动部咨询维权。",
            urgency: "LOW",
          },
        ],
        messageForEmployer: {
          korean: `안녕하세요 사장님, 이번 달 급여 중 임금명세서 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이 있는지 확인 부탁드립니다. 감사합니다.`,
          translated: `老板您好，经核对发现工资明细中的实发金额与银行实际到账金额相差约 ${diffWon}。想请您帮忙确认是否有其他扣除项目，非常感谢！`,
          language: loc,
        },
      },
    };
  }

  if (loc === "en") {
    return {
      ok: true,
      isMock: true,
      data: {
        headline: `Analysis of ${diffWon} discrepancy between actual deposit and payslip`,
        summary: `A difference of ${diffWon} was detected between the net pay on your payslip and the amount deposited into your bank account. It is necessary to verify whether there were unlisted deductions or split payments.`,
        causes: [
          {
            title: "Possible unlisted deduction",
            description: "Extra deductions such as dormitory fees, meal costs, or uniform expenses that were not agreed upon in writing may have been subtracted before transfer.",
            category: "DEDUCTION",
          },
          {
            title: "Net pay calculation variance",
            description: "There could be a minor transfer error, overtime allowance calculation omission, or banking fee variance.",
            category: "NET_PAY",
          },
        ],
        legalBasis: {
          law: "Labor Standards Act Article 43 (Principles of Wage Payment)",
          description: "Wages must be paid directly to the worker in full in currency on fixed dates every month. Arbitrary deduction is strictly prohibited by law.",
          protectionNotice: "You have the right to request a written breakdown from your employer for any deductions not listed on your payslip.",
        },
        requiredEvidence: ["Copy of this month's payslip", "Bank transaction certificate", "Standard labor contract copy"],
        nextActions: [
          {
            step: 1,
            title: "Inquire about difference with employer",
            action: "Use the provided employer message card to politely request the calculation basis.",
            urgency: "HIGH",
          },
          {
            step: 2,
            title: "Obtain revised payslip",
            action: "Request and keep a revised payslip listing itemized deductions.",
            urgency: "MEDIUM",
          },
          {
            step: 3,
            title: "Consult Foreign Workers Center or MOEL",
            action: "If unresolved, you may contact the Labor Counseling Center at 1350 for rights protection.",
            urgency: "LOW",
          },
        ],
        messageForEmployer: {
          korean: `안녕하세요 사장님, 이번 달 급여 중 임금명세서 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이 있는지 확인 부탁드립니다. 감사합니다.`,
          translated: `Hello, I noticed a difference of about ${diffWon} between the payslip net amount and the actual bank transfer for this month. Could you please check if there was any additional deduction? Thank you!`,
          language: loc,
        },
      },
    };
  }

  return {
    ok: true,
    isMock: true,
    data: {
      headline: `실지급액 대조 결과 ${diffWon} 차액 원인 분석`,
      summary: `임금명세서와 실제 통장 입금액 사이에 ${diffWon}의 차액이 확인되었습니다. 미기재된 공제 항목 또는 지급 산정 오차 가능성이 있으므로 사업주 확인이 필요합니다.`,
      causes: [
        {
          title: "공제 항목 미기재 차감",
          description: "사전 동의되지 않은 추가 공제액이 통장 입금 전 차감되었을 가능성이 있습니다.",
          category: "DEDUCTION",
        },
        {
          title: "실지급액 산정 오차",
          description: "급여 이체 과정에서의 착오 송금 또는 주휴/연장수당 차액 계산 누락 가능성이 있습니다.",
          category: "NET_PAY",
        },
      ],
      legalBasis: {
        law: "근로기준법 제43조 (임금 지급의 원칙)",
        description: "임금은 통화로 직접 근로자에게 그 전액을 지급하여야 하며 임의 공제는 엄격히 제한됩니다.",
        protectionNotice: "공제 내역이 명세서에 기재되지 않은 차액은 서면 내역을 요청하여 확인할 권리가 있습니다.",
      },
      requiredEvidence: [
        "해당 월 임금명세서",
        "은행 통장 입금 거래내역",
        "근로계약서 사본",
      ],
      nextActions: [
        {
          step: 1,
          title: "사업주에게 차액 사유 서면 확인 요청",
          action: "제공된 사업주 질문 카드를 복사하여 정중하게 산정 근거를 요청하세요.",
          urgency: "HIGH",
        },
        {
          step: 2,
          title: "수정된 임금명세서 수령 및 보관",
          action: "공제 항목별 금액이 명시된 임금명세서를 받아 보관하세요.",
          urgency: "MEDIUM",
        },
        {
          step: 3,
          title: "외국인노동자지원센터 상담 연계",
          action: "차액이 소명되지 않는 경우 관할 노동청(1350)에 상담을 요청할 수 있습니다.",
          urgency: "LOW",
        },
      ],
      messageForEmployer: {
        korean: `안녕하세요 사장님, 이번 달 급여 중 임금명세서 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이 있는지 확인 부탁드립니다. 감사합니다.`,
        translated: `Hello, I noticed a difference of about ${diffWon} between the payslip net amount and the actual bank transfer for this month. Could you please check if there was any additional deduction? Thank you!`,
        language: payload.locale,
      },
    },
  };
}

/** AI 어시스턴트 질문 (로컬 Rule/Intent 엔진으로 동작) */
export async function askAssistant(
  _question: string,
  _context: string,
  _locale: UiLocale,
): Promise<{ text: string | null; error: string | null }> {
  return { text: null, error: null };
}

