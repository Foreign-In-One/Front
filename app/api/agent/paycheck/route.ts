import { NextResponse } from "next/server";
import { won } from "@/lib/paycycle/format";

export interface AiPaycheckReportDto {
  headline: string;
  summary: string;
  causes: {
    title: string;
    description: string;
    category: "BASE_PAY" | "DEDUCTION" | "NET_PAY" | "ALLOWANCE" | "DELAY" | "UNKNOWN";
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
    const { finding, period, workplace, locale = "ko", paycheckId } = body;

    if (!paycheckId) {
      return NextResponse.json(
        { ok: false, message: "paycheckId is required for AI paycheck analysis" },
        { status: 400 }
      );
    }

    // 0. 실제 Spring Boot 백엔드 explain API 연동 시도
    const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
    try {
      const userId =
        req.headers.get("x-user-id") ||
        req.headers.get("x-demo-user-id") ||
        body.userId ||
        "1";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-User-Id": String(userId),
        "X-Demo-User-Id": String(userId),
      };

      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const beRes = await fetch(`${backendBaseUrl}/api/paychecks/${paycheckId}/explain`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers,
        body: JSON.stringify({ finding, period, workplace, locale }),
      });

      if (beRes.ok) {
        const beJson = await beRes.json();
        if (beJson.success && beJson.data) {
          const d = beJson.data;
          const diffWon = finding?.difference
            ? `${Math.abs(finding.difference).toLocaleString("ko-KR")}원`
            : "";
          const firstCard = d.employerQuestionCards?.[0];

          const defaultReasons = [
            "임금명세서 미기재 추가 공제 가능성 (기숙사비, 수도광열비, 식대, 4대보험 소급 정산 등 사전 미동의 공제)",
            "가산수당(연장·야간·휴일근로 1.5배 가산) 또는 주휴수당 산정 누락/오차",
            "사업장 급여 담당자의 단순 송금 입력 착오 또는 분할 이체",
          ];
          const reasonsList = (d.reasons && d.reasons.length > 0) ? d.reasons : defaultReasons;

          const report: AiPaycheckReportDto = {
            headline: diffWon
              ? `실제 입금액과 명세서 간 ${diffWon} 차액 원인 분석`
              : "실제 입금액과 명세서 간 차액 원인 분석",
            summary:
              d.summary ||
              (diffWon
                ? `임금명세서와 실제 통장 입금액 사이에 ${diffWon}의 차액이 확인되었습니다. 근로기준법 제43조(전액 지급의 원칙)에 따라 근로자의 사전 동의 없는 임의 공제는 제한되므로 구체적인 확인이 필요합니다.`
                : "임금명세서와 실제 통장 입금액 사이에 차액이 확인되었습니다."),
            causes: reasonsList.map((r: string) => {
              const titlePart = r.includes("(") ? r.split("(")[0].trim() : r.split(":")[0].trim();
              return {
                title: titlePart || r,
                description: r,
                category: r.includes("공제") ? "DEDUCTION" : r.includes("수당") ? "ALLOWANCE" : "NET_PAY",
              };
            }),
            legalBasis: {
              law: "근로기준법 제43조 (임금 지급의 원칙) 및 제48조 (임금명세서 교부)",
              description: "임금은 통화로 직접 근로자에게 그 전액을 정기일에 지급하여야 하며, 사전 서면 동의 없는 공제는 엄격히 제한됩니다.",
              protectionNotice: "공제 사유가 명세서에 기재되지 않은 차액은 사업주에게 서면 내역 교부를 요청할 권리가 있습니다.",
            },
            requiredEvidence: (d.requiredEvidence && d.requiredEvidence.length > 0)
              ? d.requiredEvidence
              : ["해당 월 임금명세서 사본 (지급/공제 항목)", "은행 통장 거래내역서", "표준근로계약서 사본", "출퇴근 기록부 또는 근무일지"],
            nextActions: (d.nextActions && d.nextActions.length > 0)
              ? d.nextActions.map((a: string, idx: number) => {
                  const colonIdx = a.indexOf(":");
                  const title = colonIdx !== -1 ? a.slice(0, colonIdx).trim() : `${idx + 1}단계`;
                  const action = colonIdx !== -1 ? a.slice(colonIdx + 1).trim() : a;
                  return {
                    step: idx + 1,
                    title,
                    action,
                    urgency: idx === 0 ? "HIGH" : idx === 1 ? "HIGH" : idx === 2 ? "MEDIUM" : "LOW",
                  };
                })
              : [
                  {
                    step: 1,
                    title: "1단계: 증빙 확보",
                    action: "해당 월 임금명세서 사본과 은행 통장 거래내역서를 확보합니다.",
                    urgency: "HIGH",
                  },
                  {
                    step: 2,
                    title: "2단계: 사업주 정중 문의",
                    action: "사장님 질문 카드를 활용하여 공제 사유를 정중히 문의합니다.",
                    urgency: "HIGH",
                  },
                ],
            messageForEmployer: {
              korean:
                firstCard?.koreanScript ||
                (diffWon
                  ? `안녕하세요 사장님, 이번 달 급여 중 임금명세서 실지급액과 통장 입금액 사이에 ${diffWon}의 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이나 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다.`
                  : "안녕하세요 사장님, 이번 달 급여 중 임금명세서 실지급액과 통장 입금액 사이에 차이가 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이나 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다."),
              translated:
                firstCard?.nativeScript ||
                (diffWon
                  ? `Xin chào giám đốc, lương có chênh lệch ${diffWon} giữa phiếu lương và tiền vào tài khoản, nhờ giám đốc kiểm tra giúp tôi.`
                  : "Xin chào giám đốc, lương có sự chênh lệch giữa phiếu lương và tiền vào tài khoản, nhờ giám đốc kiểm tra giúp tôi."),
              language: locale,
            },
          };

          return NextResponse.json({ ok: true, isMock: false, data: report });
        }
      }
    } catch (err) {
      console.warn("Backend explain API call bypassed to direct generator:", err);
    }

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
당신은 대한민국 고용노동부 근로기준법 및 외국인 근로자 금융권리 전문 공인노무사 수준의 AI Agent입니다.
아래의 급여 3중 대조(표준근로계약서, 임금명세서, 통장 실입금액) 대조 결과를 바탕으로, 외국인 근로자가 자신의 권리를 정확히 이해하고 사업주와 정중하게 소통할 수 있도록 전문적이고 체계적인 심층 진단 리포트를 작성하세요.

[분석 대상 데이터]
- 귀속월: ${period || "이번 달"}
- 사업장: ${workplace || "근무지"}
- 이상 징후 데이터: ${JSON.stringify(finding || {})}
- 사용자 선택 언어: ${targetLang}

[작성 지침 - 엄격 준수]
1. [언어 규칙]: "messageForEmployer.korean" 필드는 반드시 한국 사업주가 읽을 정중하고 격식 있는 '한국어'로 작성하고, 그 외 모든 필드("headline", "summary", "causes", "legalBasis", "requiredEvidence", "nextActions", "messageForEmployer.translated")는 반드시 사용자의 선택 언어인 "${targetLang}"로 작성하십시오.
2. [전문성 및 객관성]: 단정적인 법률 위반/체불 선언은 지양하고, "임금 지급의 원칙(근로기준법 제43조)", "임금명세서 필수 기재 의무(근로기준법 제48조)", "소정근로시간 및 수당 산정 기준"에 기반하여 사실 관계와 추정 원인을 구체적으로 설명하십시오.
3. [단계별 실행 방안]: 외국인 근로자가 실제로 취해야 할 조치를 1) 증빙 확보, 2) 사업주 정중 문의, 3) 수정 명세서 수령, 4) 필요시 고용노동부 상담(1350) 등 3~4단계로 구체화하십시오.
4. [사업주 질문 카드]: 계약 기본급, 명세서 실지급액, 통장 실입금액, 차액을 명확한 수치로 언급하며 공제 사유나 계산 착오 여부를 정중하게 묻는 비즈니스 서면 톤앤매너를 유지하십시오.
5. 반드시 아래의 JSON 포맷으로만 응답하십시오.

응답 JSON 스키마:
{
  "headline": "핵심 한줄 진단 (${targetLang})",
  "summary": "구체적인 사실 및 차액 원인에 대한 2~3문장의 전문적인 설명 (${targetLang})",
  "causes": [
    {
      "title": "원인 항목 제목 (${targetLang})",
      "description": "상세 분석 내용 및 노무학적 설명 (${targetLang})",
      "category": "DEDUCTION" | "NET_PAY" | "BASE_PAY" | "ALLOWANCE" | "UNKNOWN"
    }
  ],
  "legalBasis": {
    "law": "관련 법령 조항 (${targetLang})",
    "description": "해당 법령의 핵심 기준 및 4대 원칙 설명 (${targetLang})",
    "protectionNotice": "외국인 근로자가 알아야 할 실질적인 권리 보호 안내 (${targetLang})"
  },
  "requiredEvidence": ["필요한 증빙 서류 1", "필요한 증빙 서류 2", "필요한 증빙 서류 3", "필요한 증빙 서류 4"],
  "nextActions": [
    {
      "step": 1,
      "title": "행동 단계 제목 (${targetLang})",
      "action": "구체적인 행동 요령 (${targetLang})",
      "urgency": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "messageForEmployer": {
    "korean": "정중하고 격식 있는 한국어 사업주 문의 문장 (한국어)",
    "translated": "사용자 언어로 번역된 문의 문장 (${targetLang})",
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
    const diffAmount = finding?.difference ? Math.abs(finding.difference) : 0;
    const diffWon = diffAmount > 0 ? `${diffAmount.toLocaleString("ko-KR")}원` : "";
    const findingId = finding?.id || "net";

    let report: AiPaycheckReportDto;

    function getEmployerMessageTranslation(id: string, diffStr: string, per: string, loc: string): string {
      const diffVi = diffStr ? ` khoảng ${diffStr}` : "";
      const diffZh = diffStr ? `约 ${diffStr}` : "";
      const diffEn = diffStr ? ` of about ${diffStr}` : "";

      if (loc === "vi") {
        if (id === "net") {
          return `Xin chào anh/chị, cảm ơn anh/chị đã chuyển lương ${per || "tháng này"}. Tôi thấy có sự chênh lệch${diffVi} giữa số tiền thực lĩnh trên phiếu lương và số tiền thực tế nhận vào tài khoản. Nhờ anh/chị kiểm tra giúp tôi xem có khoản khấu trừ nào bổ sung không ạ. Tôi xin cảm ơn!`;
        }
        if (id === "base") {
          return `Xin chào anh/chị. Có sự chênh lệch${diffVi} giữa mức lương cơ bản trong hợp đồng và phiếu lương tháng này. Nhờ anh/chị giải thích giúp tôi cách tính này được không ạ?`;
        }
        return `Xin chào anh/chị. Tôi muốn hỏi về chi tiết lương tháng này. Khi nào thuận tiện nhờ anh/chị kiểm tra giúp tôi. Tôi xin cảm ơn.`;
      }
      if (loc === "zh") {
        if (id === "net") {
          return `老板您好，感谢您发放${per || "本月"}工资。经核对发现，工资明细中的实发金额与银行实际到账金额相差 ${diffZh}。想请您帮忙确认是否有其他扣除项目，非常感谢！`;
        }
        if (id === "base") {
          return `老板您好，合同中的基本工资与本月工资明细的基本工资相差 ${diffZh}。想向您请教一下具体的计算标准，谢谢！`;
        }
        return `老板您好，我想确认一下本月工资的具体明细，方便时请您帮忙看一下，谢谢！`;
      }
      if (loc === "en") {
        if (id === "net") {
          return `Hello, thank you for sending this month's salary (${per || "this period"}). I noticed a difference${diffEn} between the payslip net amount and the actual bank transfer. Could you please let me know if there was any additional deduction? Thank you!`;
        }
        if (id === "base") {
          return `Hello. There is a difference${diffEn} between the base salary in my contract and this month's payslip. Could you please explain how this was calculated?`;
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
        const leftDetail = finding?.left?.amount != null ? `(${won(finding.left.amount)})` : "";
        const rightDetail = finding?.right?.amount != null ? `(${won(finding.right.amount)})` : "";
        const diffPhrase = diffWon ? ` 사이에 ${diffWon}의 차액이` : "에 차이가";

        report = {
          headline: diffWon
            ? `실제 입금액과 임금명세서 실지급액 간 ${diffWon} 차액 정밀 진단`
            : "실제 입금액과 임금명세서 실지급액 간 차액 정밀 진단",
          summary: diffWon
            ? `임금명세서에 기재된 차인지급액(실지급액)과 실제 은행 계좌 입금액 사이에 ${diffWon}의 부족 차액이 감지되었습니다. 사전에 서면 동의되지 않은 임의 공제, 연장수당 정산 착오, 또는 분할 송금 여부에 대한 노무학적 사실 확인이 필요합니다.`
            : "임금명세서에 기재된 차인지급액(실지급액)과 실제 은행 계좌 입금액 사이에 부족 차액이 감지되었습니다. 사전에 서면 동의되지 않은 임의 공제, 연장수당 정산 착오, 또는 분할 송금 여부에 대한 노무학적 사실 확인이 필요합니다.",
          causes: [
            {
              title: "임금명세서 미기재 추가 공제 가능성",
              description: "기숙사비, 수도광열비, 식대, 유니폼 비용 또는 4대보험 소급 정산액이 근로자 서면 동의 없이 통장 입금 전 사전 공제되었을 가능성이 있습니다.",
              category: "DEDUCTION",
            },
            {
              title: "가산수당(연장·야간·휴일) 또는 주휴수당 산정 오차",
              description: "통상임금(시급)을 기준으로 1.5배 가산되어야 하는 연장/야간 근로시간이 누락되었거나 계산 착오로 일부 금액이 차감 송금되었을 수 있습니다.",
              category: "ALLOWANCE",
            },
            {
              title: "단순 이체 송금 착오 또는 분할 지급",
              description: "사업장 급여 담당자의 계좌 이체 금액 입력 착오, 혹은 일부 금액을 현금이나 별도 계좌로 분할 지급했을 가능성이 존재합니다.",
              category: "NET_PAY",
            },
          ],
          legalBasis: {
            law: "근로기준법 제43조 (임금 지급의 4대 원칙) & 제48조 (임금명세서 교부 의무)",
            description: "임금은 통화(통화불), 직접(직접불), 전액(전액불), 매월 1회 이상 정기일(정기불)에 근로자에게 지급되어야 합니다. 법령이나 단체협약에 명시되지 않은 공제는 법률상 무효이며, 모든 지급·공제 내역은 명세서에 항목별로 명시되어야 합니다.",
            protectionNotice: "공제 사유가 명세서에 기재되지 않은 차액은 사업주에게 서면 내역 교부를 당당히 요구할 수 있으며, 정당한 사유가 없을 경우 전액 소급 지급받을 법적 권리가 있습니다.",
          },
          requiredEvidence: [
            "해당 귀속월 임금명세서 사본 (지급 및 공제 세부 내역)",
            "은행 통장 입금 거래내역서 (입금 일시, 금액, 송금인 명의 표시)",
            "표준근로계약서 사본 (소정근로시간, 기본급, 숙식비 공제 약정서)",
            "출퇴근 기록부 또는 근무일지 (연장·야간 근로 시간 입증용)",
          ],
          nextActions: [
            {
              step: 1,
              title: "1단계: 팩트 확인 및 증빙 자료 확보",
              action: diffWon
                ? `계약서 기본급과 명세서 실지급액, 통장 실입금액 간 ${diffWon} 차액을 확인하고 명세서와 통장 내역서를 캡처해 둡니다.`
                : "계약서 기본급과 명세서 실지급액, 통장 실입금액 간 차액을 확인하고 명세서와 통장 내역서를 캡처해 둡니다.",
              urgency: "HIGH",
            },
            {
              step: 2,
              title: "2단계: 사업주/급여 담당자에게 서면 문의",
              action: "아래 제공된 '사장님 질문 카드'를 복사하여 메신저(문자/카카오톡)로 공제 사유나 계산 근거를 정중히 문의합니다.",
              urgency: "HIGH",
            },
            {
              step: 3,
              title: "3단계: 수정 임금명세서 또는 차액 수령",
              action: "단순 계산 착오 시 차액 입금을 요청하고, 추가 공제가 있다면 사유가 명시된 수정 임금명세서를 반드시 수령하여 보관하세요.",
              urgency: "MEDIUM",
            },
            {
              step: 4,
              title: "4단계: 미해결 시 고용노동부 무료 상담",
              action: "정당한 이유 없이 차액이 해결되지 않을 경우 고용노동부 상담센터(국번없이 1350) 또는 관할 외국인노동자지원센터에 권리구제를 접수하세요.",
              urgency: "LOW",
            },
          ],
          messageForEmployer: {
            korean: `안녕하세요 사장님, ${period || "이번 달"} 급여 입금해 주셔서 진심으로 감사드립니다. 급여 통장을 확인해 보았는데, 임금명세서 상의 실지급액${leftDetail}과 통장 입금액${rightDetail}${diffPhrase} 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이 있거나 계산 과정에서 확인이 필요한 부분이 있는지 알려주시면 감사하겠습니다. 늘 배려해 주셔서 감사합니다!`,
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
