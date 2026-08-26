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

  return generateLocalAiPaycheckAnalysis(payload);
}

function getCategoryFromFinding(
  finding: PayFinding,
): "BASE_PAY" | "DEDUCTION" | "NET_PAY" | "ALLOWANCE" | "DELAY" | "UNKNOWN" {
  if (finding.id === "base" || finding.id === "minwage") return "BASE_PAY";
  if (finding.id === "deduction") return "DEDUCTION";
  if (finding.id === "paydate") return "DELAY";
  if (finding.id === "net" || finding.id === "contract-deposit") return "NET_PAY";
  return "UNKNOWN";
}

function buildEmployerMessage(
  finding: PayFinding,
  period: string,
  locale: UiLocale,
): { korean: string; translated: string } {
  const diffWon =
    finding.difference && Math.abs(finding.difference) > 0
      ? `${Math.abs(finding.difference).toLocaleString("ko-KR")}원`
      : "";

  let korean = "";
  let translatedVi = "";
  let translatedZh = "";
  let translatedEn = "";

  if (finding.status === "INSUFFICIENT_DATA") {
    korean = `안녕하세요 사장님, ${period || "이번 달"} 급여 내역 확인을 위해 임금명세서 등 관련 서류를 확인해 주실 수 있는지 문의드립니다. 감사합니다!`;
    translatedVi = `Xin chào anh/chị, tôi muốn hỏi để kiểm tra lại phiếu lương và giấy tờ liên quan đến lương ${period || "tháng này"}. Nhờ anh/chị hỗ trợ giúp tôi. Tôi xin cảm ơn!`;
    translatedZh = `老板您好，我想向您确认一下${period || "本月"}的工资明细及相关材料，方便时请您帮忙看一下，非常感谢！`;
    translatedEn = `Hello, I would like to check about my payslip and related documents for ${period || "this period"}. Please let me know when you have time. Thank you!`;
  } else if (finding.status === "MATCH") {
    korean = `안녕하세요 사장님, ${period || "이번 달"} 급여가 정상적으로 잘 입금된 것을 확인했습니다. 항상 신경 써 주셔서 진심으로 감사드립니다!`;
    translatedVi = `Xin chào anh/chị, tôi đã nhận đủ lương ${period || "tháng này"} theo đúng phiếu lương và hợp đồng. Cảm ơn anh/chị rất nhiều!`;
    translatedZh = `老板您好，我已经确认收到${period || "本月"}的全额工资，金额与明细一致。非常感谢您的关照！`;
    translatedEn = `Hello, I have confirmed that my salary for ${period || "this period"} was deposited correctly in full. Thank you very much!`;
  } else {
    // EXPLANATION_REQUIRED / USER_CONFIRMATION
    if (finding.id === "base") {
      korean = `안녕하세요 사장님, ${period || "이번 달"} 근로계약서 상의 기본급과 임금명세서 상의 기본급${diffWon ? ` 사이에 ${diffWon}의 차이가` : "에 차이가"} 있어 문의드립니다. 어떤 기준으로 산정된 것인지 확인 부탁드립니다. 늘 배려해 주셔서 감사합니다!`;
      translatedVi = `Xin chào anh/chị, tôi thấy có sự chênh lệch${diffWon ? ` khoảng ${diffWon}` : ""} giữa mức lương cơ bản trong hợp đồng và phiếu lương ${period || "tháng này"}. Nhờ anh/chị giải thích giúp tôi cách tính này được không ạ? Tôi xin cảm ơn!`;
      translatedZh = `老板您好，合同中的基本工资与${period || "本月"}工资明细的基本工资相差${diffWon ? ` ${diffWon}` : ""}。想向您请教一下具体的计算标准，谢谢您！`;
      translatedEn = `Hello, there is a difference${diffWon ? ` of about ${diffWon}` : ""} between the base salary in my contract and ${period || "this month's"} payslip. Could you please explain how this was calculated? Thank you!`;
    } else if (finding.id === "deduction") {
      korean = `안녕하세요 사장님, ${period || "이번 달"} 임금명세서의 공제 항목 및 금액에 대해 상세한 내역을 확인하고자 연락드렸습니다. 시간 되실 때 확인 부탁드립니다. 감사합니다!`;
      translatedVi = `Xin chào anh/chị, tôi muốn hỏi về các khoản khấu trừ cụ thể trên phiếu lương ${period || "tháng này"}. Nhờ anh/chị kiểm tra và giải thích giúp tôi. Tôi xin cảm ơn!`;
      translatedZh = `老板您好，我想向您确认一下${period || "本月"}工资明细中各项扣款的具体明细和原因，方便时请您帮忙说明一下，非常感谢！`;
      translatedEn = `Hello, I would like to check the details and reasons for the deductions listed on ${period || "this month's"} payslip. Please let me know when you have time. Thank you!`;
    } else if (finding.id === "paydate") {
      korean = `안녕하세요 사장님, 계약상 정해진 급여일과 실제 입금 일정에 차이가 있어 확인차 연락드렸습니다. 확인 부탁드립니다. 감사합니다!`;
      translatedVi = `Xin chào anh/chị, ngày nhận lương thực tế có chênh lệch so với ngày trả lương ghi trong hợp đồng. Nhờ anh/chị kiểm tra giúp tôi. Tôi xin cảm ơn!`;
      translatedZh = `老板您好，实际发薪日期与合同约定的发薪日有所差异，想向您确认一下情况，谢谢您！`;
      translatedEn = `Hello, there seems to be a difference between the contractual payday and the actual payment date. Could you please check this? Thank you!`;
    } else {
      // net or default
      const diffPhrase = diffWon ? ` 사이에 약 ${diffWon}의 차액이` : "에 차이가";
      korean = `안녕하세요 사장님, ${period || "이번 달"} 급여 입금해 주셔서 감사드립니다. 확인 결과 임금명세서의 실지급액과 실제 통장 입금액${diffPhrase} 확인되어 연락드렸습니다. 혹시 추가로 공제된 항목이 있는지 확인 부탁드립니다. 늘 배려해 주셔서 감사합니다!`;
      translatedVi = `Xin chào anh/chị, cảm ơn anh/chị đã chuyển lương ${period || "tháng này"}. Tôi thấy có sự chênh lệch${diffWon ? ` khoảng ${diffWon}` : ""} giữa số tiền thực lĩnh trên phiếu lương và số tiền thực tế nhận vào tài khoản. Nhờ anh/chị kiểm tra giúp tôi xem có khoản khấu trừ nào bổ sung không ạ. Tôi xin cảm ơn!`;
      translatedZh = `老板您好，感谢您发放${period || "本月"}工资。经核对发现，工资明细中的实发金额与银行实际到账金额相差${diffWon ? `约 ${diffWon}` : ""}。想请您帮忙确认是否有其他扣除项目，非常感谢！`;
      translatedEn = `Hello, thank you for sending ${period || "this month's"} salary. I noticed a difference${diffWon ? ` of about ${diffWon}` : ""} between the payslip net amount and the actual bank transfer. Could you please let me know if there was any additional deduction? Thank you!`;
    }
  }

  let translated = "";
  if (locale === "vi") translated = translatedVi;
  else if (locale === "zh") translated = translatedZh;
  else if (locale === "en") translated = translatedEn;

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

  const category = getCategoryFromFinding(finding);
  const { korean, translated } = buildEmployerMessage(finding, period, locale);

  let headline = finding.title;
  let summary = finding.fact || "급여 대조 결과가 확인되었습니다.";
  let causes: AiPaycheckReportDto["causes"] = [];
  let legalBasis: AiPaycheckReportDto["legalBasis"] = {
    law: finding.standard || "근로기준법 제43조 (임금 지급의 원칙)",
    description: "임금은 통화로 직접 근로자에게 그 전액을 지급하여야 합니다.",
    protectionNotice: "근로자는 임금명세서 세부 내역 및 공제 내역을 확인할 권리가 있습니다.",
  };

  if (status === "INSUFFICIENT_DATA") {
    headline = finding.title || "급여 대조를 위한 자료 확인 필요";
    summary =
      finding.fact ||
      "대조를 완료하기 위한 서류나 데이터가 충분하지 않아 추가 확인이 필요합니다.";
    causes = [
      {
        title: finding.title || "필수 서류 확인 필요",
        description:
          finding.limitation ||
          finding.fact ||
          "필요한 급여 관련 서류가 확인되지 않아 정밀 대조를 진행할 수 없습니다.",
        category: "UNKNOWN",
      },
    ];
    legalBasis = {
      law: finding.standard || "근로기준법 제48조 (임금명세서 교부 의무)",
      description: finding.standard
        ? `${finding.standard} 기준에 따라 서류 및 내역 확인이 필요합니다.`
        : "사용자는 임금을 지급할 때 임금의 구성항목 및 계산방법 등이 적힌 임금명세서를 교부하여야 합니다.",
      protectionNotice:
        "정확한 금융권리 확인을 위해 근로계약서, 임금명세서, 통장 거래내역서를 확보하여 보관하세요.",
    };
  } else if (status === "MATCH") {
    headline = finding.title || `${period || "해당 월"} 급여 3중 대조 완료`;
    summary =
      finding.fact ||
      "근로계약서, 임금명세서, 통장 실입금액이 일치합니다.";
    causes = [
      {
        title: "정상 지급 확인",
        description:
          finding.fact ||
          "계약 조건 및 임금명세서 기준과 일치하여 정상 지급되었습니다.",
        category: "NET_PAY",
      },
    ];
    legalBasis = {
      law: finding.standard || "근로기준법 제43조 (임금 지급의 원칙)",
      description:
        "임금이 법령과 계약 조건에 맞추어 전액 정상 지급되었습니다.",
      protectionNotice:
        "교부받은 임금명세서와 은행 입금 내역은 3년간 안전하게 보관하시는 것을 권장합니다.",
    };
  } else {
    // EXPLANATION_REQUIRED / USER_CONFIRMATION
    headline = finding.title;
    summary = finding.fact;
    causes = [
      {
        title: finding.title,
        description: `${finding.fact}${
          finding.limitation ? ` (확인 범위: ${finding.limitation})` : ""
        }`,
        category,
      },
    ];
    legalBasis = {
      law: finding.standard || "근로기준법",
      description: finding.limitation
        ? `판단 기준: ${finding.standard || "근로기준법"}. (${finding.limitation})`
        : finding.standard ||
          "근로기준법 기준에 따른 사실 확인이 필요합니다.",
      protectionNotice:
        "공제 내역이나 차액에 대해 사업주에게 서면 내역 교부를 요청하여 확인할 법적 권리가 있습니다.",
    };
  }

  const requiredEvidence =
    finding.requiredEvidence && finding.requiredEvidence.length > 0
      ? finding.requiredEvidence
      : ["해당 월 임금명세서", "은행 통장 거래내역서", "표준근로계약서"];

  const nextActions =
    finding.nextActions && finding.nextActions.length > 0
      ? finding.nextActions.map((action, idx) => ({
          step: idx + 1,
          title: action,
          action,
          urgency:
            idx === 0
              ? ("HIGH" as const)
              : idx === 1
              ? ("MEDIUM" as const)
              : ("LOW" as const),
        }))
      : [
          {
            step: 1,
            title: "증빙 서류 확보",
            action: "임금명세서와 통장 거래내역서를 확보하여 보관하세요.",
            urgency: "HIGH" as const,
          },
        ];

  return {
    ok: true,
    isMock: true,
    data: {
      headline,
      summary,
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

/** AI 어시스턴트 질문 (로컬 Rule/Intent 엔진으로 동작) */
export async function askAssistant(
  _question: string,
  _context: string,
  _locale: UiLocale,
): Promise<{ text: string | null; error: string | null }> {
  return { text: null, error: null };
}

