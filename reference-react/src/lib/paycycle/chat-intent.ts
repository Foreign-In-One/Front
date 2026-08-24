import type { PayCycleState } from "./types";
import { displayDate, formatKDate, monthLabel, won } from "./format";
import { STATUS_LABEL, evaluateExit, evaluateTax, monthsWorked, dDay } from "./rule-engine";

export const SUGGESTIONS = [
  "내가 지금 확인해야 하는 건 뭐야?",
  "이번 달 월급이 왜 달라?",
  "올해 지금까지 월급 얼마 받았어?",
  "연말정산 때 뭘 준비해야 해?",
  "출국 전에 받을 돈이 뭐야?",
];

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
): string {
  const lines: string[] = [];
  const p = state.profile;
  const e = state.employment;

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

/** AI 호출이 불가능할 때 저장된 데이터로 답하는 대체 로직 */
export function localAnswer(
  question: string,
  state: PayCycleState,
  yearlyPay: number,
  monthsRecorded: number,
): ChatAnswer {
  const q = question.trim();
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));
  const latest = [...state.payRecords].sort((a, b) => b.period.localeCompare(a.period))[0];

  if (!state.profile) {
    return {
      text: "먼저 금융권리 프로필을 만들어 주세요. 근로 상태와 날짜를 등록하면 급여 확인부터 출국 정산까지 안내해 드립니다.",
      action: { label: "프로필 만들기", to: "/onboarding" },
    };
  }

  if (has("출국", "귀국", "연금", "퇴직금")) {
    const exitDate = state.employment?.exitDate;
    const dd = exitDate?.value && !exitDate.unknown ? dDay(exitDate.value) : null;
    return {
      text:
        dd === null
          ? "예상 출국일이 아직 등록되지 않았습니다. 출국 예정일을 등록하면 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액을 순서대로 확인해 드립니다."
          : `예상 출국일까지 D-${dd}입니다. 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액 4개 항목의 조건과 필요한 서류를 확인해 보세요.`,
      action: { label: "출국 정산 확인", to: "/exitcheck" },
    };
  }

  if (has("연말정산", "세금", "환급", "공제")) {
    return {
      text: `올해 확인된 급여는 ${monthsRecorded}개월 ${won(yearlyPay)}입니다. 거주자 여부, 주택청약저축 소득공제, 19% 단일세율 특례 3가지 항목의 조건을 확인해 보세요.`,
      action: { label: "연말정산 확인", to: "/taxcheck" },
    };
  }

  if (has("올해", "누적", "얼마", "총 급여", "지금까지")) {
    return {
      text: latest
        ? `올해 확인된 급여 기록은 ${monthsRecorded}건, 합계 ${won(yearlyPay)}입니다. 가장 최근 기록은 ${monthLabel(
            latest.period,
          )} ${won(latest.paidAmount)}입니다.`
        : "아직 저장된 급여 기록이 없습니다. 급여 확인을 한 번 진행하면 누적 급여가 계산됩니다.",
      action: { label: "급여 확인하기", to: "/paycheck" },
    };
  }

  if (has("일정", "캘린더", "언제")) {
    return {
      text: "금융권리 캘린더에서 급여일, 입금 확인, 세금·출국 준비 일정을 월별로 볼 수 있습니다.",
      action: { label: "캘린더 보기", to: "/calendar" },
    };
  }

  if (!latest) {
    return {
      text: "이번 달 급여 확인이 아직 진행되지 않았습니다. 근로계약서·임금명세서·입금내역을 올려 3중 대조를 해 보세요.",
      action: { label: "급여 확인하기", to: "/paycheck" },
    };
  }

  const gap = latest.analysis.findings.find((f) => f.status === "EXPLANATION_REQUIRED");
  return {
    text: gap
      ? `${monthLabel(latest.period)} 급여에서 "${gap.title}" 항목이 확인되었습니다. ${gap.fact} 사업주에게 사실관계를 확인해 보시길 권합니다.`
      : `${monthLabel(latest.period)} 급여 확인 결과는 '${STATUS_LABEL[latest.analysis.overallStatus]}'이며, 확인된 입금액은 ${won(
          latest.paidAmount,
        )}입니다.`,
    action: { label: "급여 결과 보기", to: "/paycheck" },
  };
}
