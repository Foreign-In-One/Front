import type { PayCycleState } from "./types";
import { displayDate, formatKDate, monthLabel, won } from "./format";
import { STATUS_LABEL, evaluateExit, evaluateTax, monthsWorked, dDay } from "./rule-engine";
import type { UiLocale } from "@/i18n/dict";

export const SUGGESTIONS_MAP: Record<UiLocale, string[]> = {
  ko: [
    "내가 지금 확인해야 하는 건 뭐야?",
    "이번 달 월급이 왜 달라?",
    "올해 지금까지 월급 얼마 받았어?",
    "연말정산 때 뭘 준비해야 해?",
    "출국 전에 받을 돈이 뭐야?",
  ],
  en: [
    "What should I check right now?",
    "Why is my salary different this month?",
    "How much total pay have I received this year?",
    "What should I prepare for year-end tax settlement?",
    "What money can I receive before departure?",
  ],
  vi: [
    "Tôi cần kiểm tra những gì lúc này?",
    "Tại sao lương tháng này lại khác?",
    "Năm nay tôi đã nhận được bao nhiêu tiền lương?",
    "Cần chuẩn bị gì cho quyết toán thuế cuối năm?",
    "Trước khi về nước tôi có thể nhận những khoản tiền nào?",
  ],
  zh: [
    "我现在需要确认什么？",
    "为什么这个月的工资不一样？",
    "今年目前为止一共领了多少工资？",
    "年末结算时需要准备什么？",
    "回国前能领到哪些钱？",
  ],
};

export const SUGGESTIONS = SUGGESTIONS_MAP.ko;

export function getSuggestions(locale: UiLocale = "ko"): string[] {
  return SUGGESTIONS_MAP[locale] ?? SUGGESTIONS_MAP.ko;
}

const STATUS_KO: Record<string, string> = {
  PRE_EMPLOYMENT: "취업 준비 중",
  EMPLOYED: "근무 중",
  SEPARATED: "퇴사함",
  CHANGING: "이직 준비 중",
};

/** AI에게 넘길, 실제 저장된 데이터만으로 구성한 컨텍스트 */
export function buildChatContext(
  state: PayCycleState,
  yearlyPay: number,
  monthsRecorded: number,
  locale: UiLocale = "ko",
): string {
  const lines: string[] = [];
  const p = state.profile;
  const e = state.employment;

  lines.push(`서비스 언어: ${locale}`);
  lines.push(p ? `사용자: ${p.nickname} / 국적 ${p.nationality} / 체류자격 ${p.visa}` : "프로필: 없음");
  if (e) {
    lines.push(
      `근로 상태: ${STATUS_KO[e.status] ?? e.status} / 사업장 ${e.workplace || "미입력"} / 계약 급여일 ${
        e.payDay ? `매월 ${e.payDay}일` : "모름"
      }`,
    );
    lines.push(
      `입국일 ${displayDate(e.entryDate)} / 최초 근무일 ${displayDate(e.workStartDate)} / 현 사업장 입사일 ${displayDate(
        e.currentWorkplaceStartDate,
      )} / 예상 출국일 ${displayDate(e.exitDate)}`,
    );
    const months = monthsWorked(e);
    if (months !== null) lines.push(`총 근속 개월수: 약 ${months}개월`);
    if (e.exitDate.value && !e.exitDate.unknown) lines.push(`출국까지 D-${dDay(e.exitDate.value)}`);
  } else {
    lines.push("근로 정보: 없음");
  }

  lines.push(`올해 확인된 급여: ${monthsRecorded}개월 / 합계 ${won(yearlyPay)}`);

  if (state.payRecords.length === 0) {
    lines.push("급여 확인 기록: 없음");
  } else {
    for (const r of [...state.payRecords].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 4)) {
      lines.push(
        `- ${monthLabel(r.period)} 급여: 입금 ${won(r.paidAmount)} / 판정 ${
          STATUS_LABEL[r.analysis.overallStatus]
        } / 확인 항목 ${r.analysis.findings.map((f) => f.title).join("; ") || "없음"}`,
      );
    }
  }

  const tax = evaluateTax({
    employment: state.employment,
    yearlyPay,
    monthsRecorded,
    taxProfile: state.taxProfile,
  });
  lines.push(`연말정산 항목: ${tax.map((t) => `${t.title}=${t.status}`).join(", ")}`);

  const exit = evaluateExit({
    employment: state.employment,
    exitProfile: state.exitProfile,
    totalMonths: monthsWorked(state.employment),
  });
  lines.push(`출국 정산 항목: ${exit.map((c) => `${c.title}=${c.status}`).join(", ")}`);

  const upcoming = [...state.events]
    .filter((ev) => ev.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  lines.push(
    `다가오는 일정: ${
      upcoming.map((ev) => `${formatKDate(ev.date)} ${ev.title}`).join(", ") || "없음"
    }`,
  );

  return lines.join("\n");
}

export interface ChatAnswer {
  text: string;
  action?: { label: string; to: string };
}

/** AI 호출이 불가능할 때 저장된 데이터로 답하는 대체 로직 (다국어 지원) */
export function localAnswer(
  question: string,
  state: PayCycleState,
  yearlyPay: number,
  monthsRecorded: number,
  locale: UiLocale = "ko",
): ChatAnswer {
  const q = question.toLowerCase().trim();
  const has = (...keys: string[]) => keys.some((k) => q.includes(k.toLowerCase()));
  const latest = [...state.payRecords].sort((a, b) => b.period.localeCompare(a.period))[0];

  if (!state.profile) {
    if (locale === "vi") {
      return {
        text: "Vui lòng tạo hồ sơ quyền lợi tài chính trước. Đăng ký tình trạng việc làm và ngày tháng sẽ giúp hướng dẫn từ kiểm tra lương đến thanh toán xuất cảnh.",
        action: { label: "Tạo hồ sơ", to: "/onboarding" },
      };
    }
    if (locale === "zh") {
      return {
        text: "请先创建您的金融权利档案。登记就业状态与相关日期后，系统将为您提供从工资核对到回国清算的全程指引。",
        action: { label: "创建档案", to: "/onboarding" },
      };
    }
    if (locale === "en") {
      return {
        text: "Please create your financial rights profile first. Registering your employment status and dates will guide you from pay check to departure settlement.",
        action: { label: "Create Profile", to: "/onboarding" },
      };
    }
    return {
      text: "먼저 금융권리 프로필을 만들어 주세요. 근로 상태와 날짜를 등록하면 급여 확인부터 출국 정산까지 안내해 드립니다.",
      action: { label: "프로필 만들기", to: "/onboarding" },
    };
  }

  if (has("출국", "귀국", "연금", "퇴직금", "departure", "exit", "pension", "severance", "về nước", "hưu trí", "thôi việc", "回国", "退职金", "养老金")) {
    const exitDate = state.employment?.exitDate;
    const dd = exitDate?.value && !exitDate.unknown ? dDay(exitDate.value) : null;
    
    if (locale === "vi") {
      return {
        text: dd === null
          ? "Chưa đăng ký ngày dự kiến về nước. Hãy đăng ký để kiểm tra bảo hiểm mãn hạn xuất cảnh, chi phí về nước, trợ cấp thôi việc."
          : `Còn D-${dd} đến ngày dự kiến về nước. Hãy kiểm tra điều kiện và giấy tờ cho bảo hiểm xuất cảnh, chi phí về nước, lương hưu và tiền thôi việc.`,
        action: { label: "Kiểm tra xuất cảnh", to: "/profile" },
      };
    }
    if (locale === "zh") {
      return {
        text: dd === null
          ? "尚未登记预计回国日期。登记预计日期后，系统将依次为您核对出国满期保险、归国费用保险、国民年金及退职金差额。"
          : `距离预计回国还有 D-${dd}。请确认出国满期保险、归国费用保险、国民年金与退职金的材料与条件。`,
        action: { label: "回国清算确认", to: "/profile" },
      };
    }
    if (locale === "en") {
      return {
        text: dd === null
          ? "Expected departure date is not registered yet. Registering it will help you check departure guarantee insurance, return cost insurance, and pension lump-sum."
          : `D-${dd} until your expected departure. Check the requirements and documents for departure insurance, return cost insurance, pension, and severance.`,
        action: { label: "Check Exit Settlement", to: "/profile" },
      };
    }
    return {
      text:
        dd === null
          ? "예상 출국일이 아직 등록되지 않았습니다. 출국 예정일을 등록하면 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액을 순서대로 확인해 드립니다."
          : `예상 출국일까지 D-${dd}입니다. 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액 4개 항목의 조건과 필요한 서류를 확인해 보세요.`,
      action: { label: "출국 정산 확인", to: "/profile" },
    };
  }

  if (has("연말정산", "세금", "환급", "공제", "tax", "settlement", "thuế", "quyết toán", "税务", "退税", "年末结算")) {
    if (locale === "vi") {
      return {
        text: `Tổng thu nhập đã ghi nhận năm nay là ${won(yearlyPay)} (${monthsRecorded} tháng). Hãy kiểm tra tư cách cư trú, khấu trừ tiết kiệm nhà ở và thuế suất ưu đãi 19%.`,
        action: { label: "Kiểm tra thuế", to: "/paycheck" },
      };
    }
    if (locale === "zh") {
      return {
        text: `今年已确认的工资为 ${monthsRecorded} 个月，共计 ${won(yearlyPay)}。请核对居民身份、住房储蓄所得扣除与 19% 单一税率特例。`,
        action: { label: "税务核对", to: "/paycheck" },
      };
    }
    if (locale === "en") {
      return {
        text: `Confirmed pay for this year is ${won(yearlyPay)} over ${monthsRecorded} months. Check your tax residency, housing savings deduction, and 19% flat tax rate option.`,
        action: { label: "Check Tax Info", to: "/paycheck" },
      };
    }
    return {
      text: `올해 확인된 급여는 ${monthsRecorded}개월 ${won(yearlyPay)}입니다. 거주자 여부, 주택청약저축 소득공제, 19% 단일세율 특례 3가지 항목의 조건을 확인해 보세요.`,
      action: { label: "연말정산 확인", to: "/paycheck" },
    };
  }

  if (has("올해", "누적", "얼마", "총 급여", "지금까지", "total", "year", "tổng", "bao nhiêu", "一共", "累计", "多少")) {
    if (locale === "vi") {
      return {
        text: latest
          ? `Năm nay có ${monthsRecorded} bản ghi lương, tổng cộng ${won(yearlyPay)}. Bản ghi gần nhất là ${monthLabel(latest.period)} với ${won(latest.paidAmount)}.`
          : "Chưa có bản ghi lương nào được lưu. Hãy thực hiện kiểm tra lương một lần.",
        action: { label: "Kiểm tra lương", to: "/paycheck" },
      };
    }
    if (locale === "zh") {
      return {
        text: latest
          ? `今年已确认的工资记录共 ${monthsRecorded} 笔，累计 ${won(yearlyPay)}。最近一次记录为 ${monthLabel(latest.period)} ${won(latest.paidAmount)}。`
          : "尚无已保存的工资记录。进行一次工资核对后将自动计算累计金额。",
        action: { label: "核对工资", to: "/paycheck" },
      };
    }
    if (locale === "en") {
      return {
        text: latest
          ? `Confirmed pay records this year: ${monthsRecorded} entries, totaling ${won(yearlyPay)}. Most recent record is ${monthLabel(latest.period)} with ${won(latest.paidAmount)}.`
          : "No saved pay records yet. Run a paycheck verification to calculate cumulative pay.",
        action: { label: "Verify Paycheck", to: "/paycheck" },
      };
    }
    return {
      text: latest
        ? `올해 확인된 급여 기록은 ${monthsRecorded}건, 합계 ${won(yearlyPay)}입니다. 가장 최근 기록은 ${monthLabel(
            latest.period,
          )} ${won(latest.paidAmount)}입니다.`
        : "아직 저장된 급여 기록이 없습니다. 급여 확인을 한 번 진행하면 누적 급여가 계산됩니다.",
      action: { label: "급여 확인하기", to: "/paycheck" },
    };
  }

  if (has("일정", "캘린더", "언제", "calendar", "schedule", "when", "lịch", "khi nào", "日历", "日程", "什么时候")) {
    if (locale === "vi") {
      return {
        text: "Bạn có thể xem ngày trả lương, xác nhận tiền vào, lịch thuế và chuẩn bị về nước trên Lịch Quyền Lợi Tài Chính.",
        action: { label: "Xem Lịch", to: "/calendar" },
      };
    }
    if (locale === "zh") {
      return {
        text: "您可以在金融权利日历中按月查看发薪日、到账确认、税务以及回国准备日程。",
        action: { label: "查看日历", to: "/calendar" },
      };
    }
    if (locale === "en") {
      return {
        text: "You can view your payday, deposit checks, tax schedules, and departure preparation milestones in the Financial Calendar.",
        action: { label: "View Calendar", to: "/calendar" },
      };
    }
    return {
      text: "금융권리 캘린더에서 급여일, 입금 확인, 세금·출국 준비 일정을 월별로 볼 수 있습니다.",
      action: { label: "캘린더 보기", to: "/calendar" },
    };
  }

  if (!latest) {
    if (locale === "vi") {
      return {
        text: "Chưa tiến hành đối chiếu lương tháng này. Hãy tải lên hợp đồng, phiếu lương và sao kê tài khoản để kiểm tra 3 bên.",
        action: { label: "Đối chiếu lương", to: "/paycheck" },
      };
    }
    if (locale === "zh") {
      return {
        text: "本月尚未进行工资核对。请上传劳动合同、工资明细与到账记录进行三重比对。",
        action: { label: "开始核对", to: "/paycheck" },
      };
    }
    if (locale === "en") {
      return {
        text: "This month's paycheck verification has not been performed yet. Upload your contract, payslip, and bank statement to run 3-way verification.",
        action: { label: "Verify Paycheck", to: "/paycheck" },
      };
    }
    return {
      text: "이번 달 급여 확인이 아직 진행되지 않았습니다. 근로계약서·임금명세서·입금내역을 올려 3중 대조를 해 보세요.",
      action: { label: "급여 확인하기", to: "/paycheck" },
    };
  }

  const gap = latest.analysis.findings.find((f) => f.status === "EXPLANATION_REQUIRED");
  if (locale === "vi") {
    return {
      text: gap
        ? `Trong lương ${monthLabel(latest.period)}, mục '${gap.title}' cần xác minh (${gap.fact}). Khuyến nghị liên hệ với người sử dụng lao động để làm rõ.`
        : `Kết quả đối chiếu lương ${monthLabel(latest.period)} là '${STATUS_LABEL[latest.analysis.overallStatus]}', số tiền thực nhận là ${won(latest.paidAmount)}.`,
      action: { label: "Xem kết quả", to: "/paycheck" },
    };
  }
  if (locale === "zh") {
    return {
      text: gap
        ? `${monthLabel(latest.period)} 工资中发现异常项目 '${gap.title}'（${gap.fact}）。建议向雇主核实具体事实。`
        : `${monthLabel(latest.period)} 工资核对结果为 '${STATUS_LABEL[latest.analysis.overallStatus]}'，确认到账金额为 ${won(latest.paidAmount)}。`,
      action: { label: "查看结果", to: "/paycheck" },
    };
  }
  if (locale === "en") {
    return {
      text: gap
        ? `In ${monthLabel(latest.period)} paycheck, item '${gap.title}' requires explanation (${gap.fact}). We recommend verifying the facts with your employer.`
        : `${monthLabel(latest.period)} paycheck result is '${STATUS_LABEL[latest.analysis.overallStatus]}', and confirmed deposit is ${won(latest.paidAmount)}.`,
      action: { label: "View Result", to: "/paycheck" },
    };
  }
  return {
    text: gap
      ? `${monthLabel(latest.period)} 급여에서 "${gap.title}" 항목이 확인되었습니다. ${gap.fact} 사업주에게 사실관계를 확인해 보시길 권합니다.`
      : `${monthLabel(latest.period)} 급여 확인 결과는 '${STATUS_LABEL[latest.analysis.overallStatus]}'이며, 확인된 입금액은 ${won(
          latest.paidAmount,
        )}입니다.`,
    action: { label: "급여 결과 보기", to: "/paycheck" },
  };
}
