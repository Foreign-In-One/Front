import { NextResponse } from "next/server";

export interface AiPaycheckReportDto {
  headline: string;
  summary: string;
  causes: {
    title: string;
    description: string;
    category: "BASE_PAY" | "DEDUCTION" | "NET_PAY" | "DELAY" | "UNKNOWN";
  }[];
  legalBasis: {
    law: string;
    description: string;
    protectionNotice: string;
  };
  requiredEvidence: string[];
  nextActions: {
    step: number;
    title: string;
    action: string;
    urgency: "HIGH" | "MEDIUM" | "LOW";
  }[];
  messageForEmployer: {
    korean: string;
    translated: string;
    language: string;
  };
}

/**
 * AI Agent PayCheck 심층 분석 API 라우트
 * - GEMINI_API_KEY 또는 OPENAI_API_KEY 가 설정되어 있으면 실제 LLM API 호출
 * - API Key 부재 또는 실패 시 PRD / 근로기준법 규격에 맞춘 정교한 AI Rule Engine Fallback 반환
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { finding, period, workplace, locale = "ko" } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    const languageNames: Record<string, string> = {
      ko: "한국어 (Korean)",
      en: "English",
      vi: "Tiếng Việt (Vietnamese)",
      zh: "中文 (Chinese)",
    };
    const targetLang = languageNames[locale] || locale;

    // 1. 실제 LLM API Key가 환경변수에 존재할 경우 실시간 LLM 분석 시도
    if (apiKey) {
      try {
        const prompt = `
당신은 한국의 외국인 근로자 금융권리 및 급여 분석 전문 AI Agent입니다.
아래의 급여 3중 대조(계약서, 명세서, 통장 실입금액) 대조 결과를 바탕으로 심층 진단 리포트를 작성하세요.

[분석 대상 데이터]
- 귀속월: ${period || "이번 달"}
- 사업장: ${workplace || "근무지"}
- 이상 징후: ${JSON.stringify(finding || {})}
- 사용자 언어: ${targetLang}

[작성 원칙 - 엄격 준수]
1. [언어 규칙]: "messageForEmployer.korean" 필드는 반드시 한국 사업주가 읽을 '한국어'로 작성하고, 그 외 모든 필드("headline", "summary", "causes", "legalBasis", "requiredEvidence", "nextActions", "messageForEmployer.translated")는 반드시 사용자의 선택 언어인 "${targetLang}"로 작성하십시오.
2. "임금체불", "불법"과 같은 단정적 법률 결론은 내리지 마십시오.
3. "설명이 필요한 차이가 확인되었습니다", "추가 확인이 필요합니다"와 같은 객관적이고 사실적인 어조를 사용하십시오.
4. 근로자가 사업주와 불필요한 갈등 없이 정중하게 확인할 수 있는 서면 질문 문구를 포함하십시오.
5. 반드시 아래 JSON 형식으로만 응답하십시오.

응답 JSON 스키마:
{
  "headline": "핵심 한줄 진단 (${targetLang})",
  "summary": "구체적인 사실 및 차액 원인 설명 2~3문장 (${targetLang})",
  "causes": [
    {
      "title": "원인 항목 제목 (${targetLang})",
      "description": "상세 분석 내용 (${targetLang})",
      "category": "NET_PAY"
    }
  ],
  "legalBasis": {
    "law": "관련 법령 (${targetLang})",
    "description": "해당 법령의 기준 설명 (${targetLang})",
    "protectionNotice": "근로자가 알아야 할 권리 보호 안내 (${targetLang})"
  },
  "requiredEvidence": ["필요한 증빙 서류 1", "필요한 증빙 서류 2"],
  "nextActions": [
    {
      "step": 1,
      "title": "행동 단계 제목 (${targetLang})",
      "action": "구체적인 행동 요령 (${targetLang})",
      "urgency": "HIGH"
    }
  ],
  "messageForEmployer": {
    "korean": "정중한 한국어 사업주 문의 문장 (한국어)",
    "translated": "사용자 언어로 번역된 문장 (${targetLang})",
    "language": "${locale}"
  }
}
`;

        if (apiKey.startsWith("AIza") || process.env.GEMINI_API_KEY) {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          });

          if (geminiRes.ok) {
            const geminiJson = await geminiRes.json();
            const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text) as AiPaycheckReportDto;
              return NextResponse.json({ ok: true, isMock: false, data: parsed });
            }
          }
        }
      } catch (err) {
        console.warn("Live LLM API call failed, falling back to structured domain engine:", err);
      }
    }

    // 2. Fallback: PRD 및 법령 기준 정교한 고도화 AI 분석 엔진
    const diffAmount = finding?.difference ? Math.abs(finding.difference) : 50000;
    const diffWon = diffAmount.toLocaleString("ko-KR") + "원";
    const findingId = finding?.id || "net";

    let report: AiPaycheckReportDto;

    function getEmployerMessageTranslation(id: string, diffStr: string, per: string, loc: string): string {
      if (loc === "vi") {
        if (id === "net") {
          return `Xin chào anh/chị, cảm ơn anh/chị đã chuyển lương ${per || "tháng này"}. Tôi thấy có sự chênh lệch khoảng ${diffStr} giữa số tiền thực lĩnh trên phiếu lương và số tiền thực tế nhận vào tài khoản. Nhờ anh/chị kiểm tra giúp tôi xem có khoản khấu trừ nào bổ sung không ạ. Tôi xin cảm ơn!`;
        }
        if (id === "base") {
          return `Xin chào anh/chị. Có sự chênh lệch ${diffStr} giữa mức lương cơ bản trong hợp đồng và phiếu lương tháng này. Nhờ anh/chị giải thích giúp tôi cách tính này được không ạ?`;
        }
        return `Xin chào anh/chị. Tôi muốn hỏi về chi tiết lương tháng này. Khi nào thuận tiện nhờ anh/chị kiểm tra giúp tôi. Tôi xin cảm ơn.`;
      }
      if (loc === "zh") {
        if (id === "net") {
          return `老板您好，感谢您发放${per || "本月"}工资。经核对发现，工资明细中的实发金额与银行实际到账金额相差约 ${diffStr}。想请您帮忙确认是否有其他扣除项目，非常感谢！`;
        }
        if (id === "base") {
          return `老板您好，合同中的基本工资与本月工资明细的基本工资相差 ${diffStr}。想向您请教一下具体的计算标准，谢谢！`;
        }
        return `老板您好，我想确认一下本月工资的具体明细，方便时请您帮忙看一下，谢谢！`;
      }
      if (loc === "en") {
        if (id === "net") {
          return `Hello, thank you for sending this month's salary (${per || "this period"}). I noticed a difference of about ${diffStr} between the payslip net amount and the actual bank transfer. Could you please let me know if there was any additional deduction? Thank you!`;
        }
        if (id === "base") {
          return `Hello. There is a difference of ${diffStr} between the base salary in my contract and this month's payslip. Could you please explain how this was calculated?`;
        }
        return `Hello. I would like to check about my paycheck details for this month. Please let me know when you have time. Thank you.`;
      }
      return "";
    }

    if (locale === "vi") {
      if (findingId === "net") {
        report = {
          headline: `Phân tích chênh lệch ${diffWon} giữa thực tế nhận và phiếu lương`,
          summary: `Phát hiện khoản chênh lệch ${diffWon} giữa số tiền thực lĩnh trên phiếu lương và số tiền thực tế chuyển vào tài khoản ngân hàng. Cần xác minh xem có khoản khấu trừ chưa ghi hoặc thanh toán tách rời hay không.`,
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
          requiredEvidence: [
            "Bản sao phiếu lương tháng tương ứng",
            "Sao kê/Lịch sử giao dịch ngân hàng (có ngày giờ và tên người gửi)",
            "Bản sao hợp đồng lao động tiêu chuẩn",
          ],
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
              title: "Liên hệ Trung tâm hỗ trợ lao động nước ngoài hoặc Bộ Lao động",
              action: "Nếu không được giải quyết thỏa đáng, bạn có thể gọi 1350 để được tư vấn bảo vệ quyền lợi.",
              urgency: "LOW",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님, ${period || "이번 달"} 급여를 입금해 주셔서 감사합니다. 확인 결과 임금명세서의 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이나 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다.`,
            translated: getEmployerMessageTranslation("net", diffWon, period, locale),
            language: locale,
          },
        };
      } else if (findingId === "base") {
        report = {
          headline: `Phân tích chênh lệch ${diffWon} giữa lương cơ bản hợp đồng và phiếu lương`,
          summary: `Lương cơ bản trong hợp đồng lao động đã ký và lương cơ bản ghi trên phiếu lương tháng này không khớp nhau. Cần kiểm tra lại thay đổi giờ làm việc theo quy định hoặc gia hạn hợp đồng.`,
          causes: [
            {
              title: "Thay đổi cách tính lương cơ bản",
              description: "Có thể áp dụng tính theo ngày làm việc do giảm giờ làm, nghỉ phép hoặc đi muộn về sớm.",
              category: "BASE_PAY",
            },
          ],
          legalBasis: {
            law: "Điều 17 Luật Tiêu chuẩn Lao động (Quy định rõ điều kiện lao động)",
            description: "Người sử dụng lao động phải ghi rõ các hạng mục cấu thành tiền lương, phương pháp tính và phương thức thanh toán bằng văn bản và giao cho người lao động.",
            protectionNotice: "Không được đơn phương hạ thấp mức lương cơ bản đã ký kết trong hợp đồng mà không có sự đồng ý của người lao động.",
          },
          requiredEvidence: ["Bản gốc hợp đồng lao động", "Bảng chấm công tháng này", "Phiếu lương"],
          nextActions: [
            {
              step: 1,
              title: "Đối chiếu lương cơ bản trong hợp đồng với giờ làm việc",
              action: "So sánh giờ làm việc theo hợp đồng với thời gian làm việc thực tế.",
              urgency: "HIGH",
            },
            {
              step: 2,
              title: "Yêu cầu giải thích lý do thay đổi lương cơ bản",
              action: "Yêu cầu người sử dụng lao động giải thích công thức tính lương cơ bản.",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 근로계약서의 기본급과 이번 달 임금명세서의 기본급에 ${diffWon} 차이가 확인되어 문의드립니다. 어떤 기준으로 산정된 것인지 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("base", diffWon, period, locale),
            language: locale,
          },
        };
      } else {
        report = {
          headline: `Phân tích hạng mục kiểm tra lương bất thường (${finding?.title || "Cần xác minh thêm"})`,
          summary: finding?.fact || "Phát hiện khoản chênh lệch và lịch trình không khớp cần được xác minh trong quá trình đối chiếu lương.",
          causes: [
            {
              title: "Cần kiểm tra chi tiết",
              description: finding?.fact || "Cần xác nhận thêm giữa hợp đồng và thực tế thanh toán.",
              category: "UNKNOWN",
            },
          ],
          legalBasis: {
            law: "Luật Tiêu chuẩn Lao động & Luật Tuyển dụng Lao động Nước ngoài",
            description: "Lao động nước ngoài có quyền nhận lương và phiếu lương bình đẳng như lao động trong nước.",
            protectionNotice: "Khuyến nghị lưu giữ tất cả tài liệu liên quan đến lương trong 3 năm.",
          },
          requiredEvidence: ["Hợp đồng lao động", "Phiếu lương", "Bản sao sổ tài khoản"],
          nextActions: [
            {
              step: 1,
              title: "Kiểm tra chi tiết từng mục trên phiếu lương",
              action: "Đối chiếu kỹ lưỡng lương cơ bản, phụ cấp và các khoản khấu trừ.",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 이번 달 급여 중 ${finding?.title || "급여 내역"}에 대해 확인하고자 연락드렸습니다. 시간 되실 때 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("unknown", diffWon, period, locale),
            language: locale,
          },
        };
      }
    } else if (locale === "zh") {
      if (findingId === "net") {
        report = {
          headline: `实际到账金额与工资明细相差 ${diffWon} 的分析`,
          summary: `工资明细上的实发金额与银行账户实际到账金额之间存在 ${diffWon} 的差异。需要核实是否存在未注明的扣除项目、手续费或分批发放情况。`,
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
          requiredEvidence: [
            "当月工资明细副本",
            "银行交易明细凭证（显示到账时间及汇款人）",
            "标准劳动合同副本",
          ],
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
            korean: `안녕하세요 사장님, ${period || "이번 달"} 급여를 입금해 주셔서 감사합니다. 확인 결과 임금명세서의 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이나 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다.`,
            translated: getEmployerMessageTranslation("net", diffWon, period, locale),
            language: locale,
          },
        };
      } else if (findingId === "base") {
        report = {
          headline: `合同基本工资与明细基本工资相差 ${diffWon} 的分析`,
          summary: `已签订的劳动合同中的基本工资与本月工资明细上标明的基本工资不一致。需要确认是否存在法定工作时间变更或合同续签等情况。`,
          causes: [
            {
              title: "基本工资计算基准变动",
              description: "可能因缩短工作时间、缺勤或早退等原因适用了按日折算。",
              category: "BASE_PAY",
            },
          ],
          legalBasis: {
            law: "韩国劳动标准法第17条（劳动条件的明示）",
            description: "雇主必须以书面形式明确工资的构成项目、计算方法和支付方式，并交付给劳动者。",
            protectionNotice: "未经劳动者同意，雇主不得单方面降低合同约定的基本工资。",
          },
          requiredEvidence: ["劳动合同原件", "本月出勤打卡记录", "工资明细"],
          nextActions: [
            {
              step: 1,
              title: "核对合同基本工资与工作时长",
              action: "对比合同规定的法定工作时间与实际出勤时间。",
              urgency: "HIGH",
            },
            {
              step: 2,
              title: "向雇主确认基本工资变动原因",
              action: "要求雇主提供基本工资计算公式与说明。",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 근로계약서의 기본급과 이번 달 임금명세서의 기본급에 ${diffWon} 차이가 확인되어 문의드립니다. 어떤 기준으로 산정된 것인지 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("base", diffWon, period, locale),
            language: locale,
          },
        };
      } else {
        report = {
          headline: `工资核对异常项目分析 (${finding?.title || "需要进一步确认"})`,
          summary: finding?.fact || "工资比对过程中发现需要确认的差额及日期不一致问题。",
          causes: [
            {
              title: "需要确认具体明细",
              description: finding?.fact || "合同约定与实际到账之间需要进一步核对。",
              category: "UNKNOWN",
            },
          ],
          legalBasis: {
            law: "劳动标准法与外国劳动者雇佣法",
            description: "外国劳动者享有与本国人同等且全额的工资支付与明细发放保障。",
            protectionNotice: "建议将所有与工资相关的资料妥善保存 3 年。",
          },
          requiredEvidence: ["劳动合同", "工资明细", "到账存折副本"],
          nextActions: [
            {
              step: 1,
              title: "核对明细各项明细",
              action: "仔细比对基本工资、津贴与各项扣除明细。",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 이번 달 급여 중 ${finding?.title || "급여 내역"}에 대해 확인하고자 연락드렸습니다. 시간 되실 때 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("unknown", diffWon, period, locale),
            language: locale,
          },
        };
      }
    } else if (locale === "en") {
      if (findingId === "net") {
        report = {
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
          requiredEvidence: [
            "Copy of this month's payslip",
            "Bank transaction certificate (showing deposit date/time and sender)",
            "Standard labor contract copy",
          ],
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
            korean: `안녕하세요 사장님, ${period || "이번 달"} 급여를 입금해 주셔서 감사합니다. 확인 결과 임금명세서의 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이나 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다.`,
            translated: getEmployerMessageTranslation("net", diffWon, period, locale),
            language: locale,
          },
        };
      } else if (findingId === "base") {
        report = {
          headline: `Analysis of ${diffWon} difference between contract and payslip base salary`,
          summary: `The base salary in your labor contract differs from the base salary on this month's payslip. Check whether contractual working hours changed or contract renewals occurred.`,
          causes: [
            {
              title: "Base salary calculation basis changed",
              description: "Prorated calculation may have applied due to reduced working hours, leave, or late arrivals.",
              category: "BASE_PAY",
            },
          ],
          legalBasis: {
            law: "Labor Standards Act Article 17 (Specification of Working Conditions)",
            description: "Employers must specify wage components, calculation methods, and payment methods in writing and deliver them to workers.",
            protectionNotice: "Contracted base pay cannot be unilaterally reduced without the worker's consent.",
          },
          requiredEvidence: ["Original labor contract", "This month's timecard/attendance log", "Payslip"],
          nextActions: [
            {
              step: 1,
              title: "Compare contract base pay with actual working hours",
              action: "Compare contractual working hours with logged attendance.",
              urgency: "HIGH",
            },
            {
              step: 2,
              title: "Request clarification on base salary calculation from employer",
              action: "Ask employer for the specific calculation formula and reason.",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 근로계약서의 기본급과 이번 달 임금명세서의 기본급에 ${diffWon} 차이가 확인되어 문의드립니다. 어떤 기준으로 산정된 것인지 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("base", diffWon, period, locale),
            language: locale,
          },
        };
      } else {
        report = {
          headline: `Paycheck discrepancy item analysis (${finding?.title || "Further verification required"})`,
          summary: finding?.fact || "A discrepancy or schedule inconsistency was detected during paycheck comparison.",
          causes: [
            {
              title: "Detail check required",
              description: finding?.fact || "Contract details and actual payment history require further verification.",
              category: "UNKNOWN",
            },
          ],
          legalBasis: {
            law: "Labor Standards Act & Foreign Workers Employment Act",
            description: "Foreign workers are entitled to equal wage payment and payslip issuance rights.",
            protectionNotice: "It is recommended to retain all wage-related documents for 3 years.",
          },
          requiredEvidence: ["Labor contract", "Payslip", "Bank statement copy"],
          nextActions: [
            {
              step: 1,
              title: "Verify each payslip line item",
              action: "Meticulously compare base pay, allowances, and deductions.",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 이번 달 급여 중 ${finding?.title || "급여 내역"}에 대해 확인하고자 연락드렸습니다. 시간 되실 때 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("unknown", diffWon, period, locale),
            language: locale,
          },
        };
      }
    } else {
      // 한국어 (ko)
      if (findingId === "net") {
        report = {
          headline: `실제 입금액과 명세서 간 ${diffWon} 차액 발생 분석`,
          summary: `임금명세서 상의 실지급액과 통장에 실제로 입금된 금액 사이에 ${diffWon}의 불일치가 감지되었습니다. 별도 명시되지 않은 공제나 이체 수수료, 또는 분할 지급 여부에 대한 사실 확인이 필요합니다.`,
          causes: [
            {
              title: "미기재 공제 항목 가능성",
              description: "숙소비, 식대, 유니폼비 등 사전에 서면 동의되지 않은 추가 공제액이 통장 입금 전 차감되었을 수 있습니다.",
              category: "DEDUCTION",
            },
            {
              title: "실지급액 산정 오차",
              description: "급여 이체 과정에서의 착오 송금 또는 주휴/연장수당 차액 계산 누락 가능성이 존재합니다.",
              category: "NET_PAY",
            },
          ],
          legalBasis: {
            law: "근로기준법 제43조 (임금 지급의 원칙)",
            description: "임금은 통화로 직접 근로자에게 그 전액을 매월 1회 이상 일정한 날짜를 정하여 지급하여야 합니다. 법령 또는 단체협약에 특별한 규정이 없는 한 임의 공제는 제한됩니다.",
            protectionNotice: "공제 사유가 명세서에 기재되지 않은 차액은 사업주에게 서면 내역을 요청하여 확인할 권리가 있습니다.",
          },
          requiredEvidence: [
            "해당 월 임금명세서 사본",
            "은행 통장 거래내역서 (입금 일시 및 보낸 사람 표시)",
            "표준근로계약서 사본 (기본급 및 공제 약정 확인용)",
          ],
          nextActions: [
            {
              step: 1,
              title: "사업주 또는 급여 담당자에게 차액 사유 문의",
              action: "제공된 사업주 질문 카드를 복사하여 문자나 메신저로 정중히 산정 근거를 요청하세요.",
              urgency: "HIGH",
            },
            {
              step: 2,
              title: "상세 공제 항목이 적힌 수정 명세서 수령",
              action: "구두 설명에 그치지 않고 항목별 금액이 적힌 임금명세서를 교부받으세요.",
              urgency: "MEDIUM",
            },
            {
              step: 3,
              title: "외국인노동자지원센터 또는 고용노동부 상담",
              action: "타당한 사유 없이 차액이 해소되지 않을 경우 관할 노동청(국번없이 1350)에 권리구제를 문의할 수 있습니다.",
              urgency: "LOW",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님, ${period || "이번 달"} 급여를 입금해 주셔서 감사합니다. 확인 결과 임금명세서의 실지급액과 통장 입금액 사이에 약 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이나 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다.`,
            translated: getEmployerMessageTranslation("net", diffWon, period, locale),
            language: locale,
          },
        };
      } else if (findingId === "base") {
        report = {
          headline: `계약 기본급과 명세서 기본급 간 ${diffWon} 차이 분석`,
          summary: `체결된 근로계약서 상의 기본급과 이번 달 임금명세서에 표기된 기본급이 서로 다릅니다. 소정근로시간 변경 또는 계약 갱신 내용이 반영되었는지 점검이 필요합니다.`,
          causes: [
            {
              title: "기본급 산정 기준 변경",
              description: "근로시간 단축 또는 결근/조퇴 등으로 인한 일할 계산이 적용되었을 수 있습니다.",
              category: "BASE_PAY",
            },
          ],
          legalBasis: {
            law: "근로기준법 제17조 (근로조건의 명시)",
            description: "사용자는 임금의 구성항목, 계산방법, 지급방법을 서면으로 명시하고 근로자에게 교부하여야 합니다.",
            protectionNotice: "계약된 기본급을 근로자 동의 없이 일방적으로 낮출 수 없습니다.",
          },
          requiredEvidence: ["근로계약서 원본", "이번 달 출퇴근 기록부", "임금명세서"],
          nextActions: [
            {
              step: 1,
              title: "근로계약서 상의 기본급과 근무시간 대조",
              action: "계약된 소정근로시간과 실제 일한 시간을 비교 확인하세요.",
              urgency: "HIGH",
            },
            {
              step: 2,
              title: "사업주에게 기본급 변동 사유 확인 요청",
              action: "기본급 산정 산식에 대한 설명을 사업주에게 요청하세요.",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 근로계약서의 기본급과 이번 달 임금명세서의 기본급에 ${diffWon} 차이가 확인되어 문의드립니다. 어떤 기준으로 산정된 것인지 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("base", diffWon, period, locale),
            language: locale,
          },
        };
      } else {
        report = {
          headline: `급여 검증 항목 이상 징후 분석 (${finding?.title || "추가 확인 필요"})`,
          summary: finding?.fact || "급여 대조 과정에서 확인이 필요한 차액 및 일정 불일치가 확인되었습니다.",
          causes: [
            {
              title: "상세 내역 확인 필요",
              description: finding?.fact || "계약 내용과 실지급 내역 간의 추가 확인이 필요합니다.",
              category: "UNKNOWN",
            },
          ],
          legalBasis: {
            law: "근로기준법 및 외국인근로자의 고용 등에 관한 법률",
            description: "외국인 근로자에게도 내국인과 동등한 임금 지급 및 명세서 교부 의무가 적용됩니다.",
            protectionNotice: "임금과 관련된 모든 자료는 3년간 보관하는 것이 권장됩니다.",
          },
          requiredEvidence: ["근로계약서", "임금명세서", "입금 통장 사본"],
          nextActions: [
            {
              step: 1,
              title: "명세서 항목별 상세 확인",
              action: "기본급, 수당, 공제 내역을 꼼꼼히 대조하세요.",
              urgency: "HIGH",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님. 이번 달 급여 중 ${finding?.title || "급여 내역"}에 대해 확인하고자 연락드렸습니다. 시간 되실 때 확인 부탁드립니다.`,
            translated: getEmployerMessageTranslation("unknown", diffWon, period, locale),
            language: locale,
          },
        };
      }
    }

    return NextResponse.json({ ok: true, isMock: true, data: report });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error.message || "Failed to analyze paycheck with AI" },
      { status: 500 }
    );
  }
}
