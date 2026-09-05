import { translate as tr } from "@/i18n";
import { LAW, MIN_WAGE } from "./law";
import { addDays, daysBetween, formatKDate, isoDate, monthLabel, won } from "./format";
import type {
  ComparisonRow,
  DocFields,
  EmploymentProfile,
  ExitClaim,
  ExitProfile,
  PayCheckStatus,
  PayDocuments,
  PayFinding,
  PaycheckAnalysis,
  RuleStatus,
  TaxCard,
  TaxProfile,
} from "./types";

const TOLERANCE = 1000; // 원 단위 반올림 오차 허용

export function statusLabel(status: PayCheckStatus): string {
  switch (status) {
    case "MATCH":
      return tr("rule.status.MATCH");
    case "EXPLANATION_REQUIRED":
      return tr("rule.status.EXPLANATION_REQUIRED");
    case "INSUFFICIENT_DATA":
      return tr("rule.status.INSUFFICIENT_DATA");
    case "USER_CONFIRMATION":
      return tr("rule.status.USER_CONFIRMATION");
    default:
      return status;
  }
}

/** @deprecated 정적 객체는 언어 변경에 반응하지 않습니다. statusLabel(status)를 사용하세요. */
export const STATUS_LABEL: Record<PayCheckStatus, string> = new Proxy(
  {} as Record<PayCheckStatus, string>,
  {
    get: (_t, prop) => statusLabel(prop as PayCheckStatus),
  },
);

export function ruleStatusLabel(status: RuleStatus | "대상 후보"): string {
  switch (status) {
    case "적용 가능성 있음":
      return tr("rule.rulestatus.applicable");
    case "조건 미충족":
      return tr("rule.rulestatus.notMet");
    case "추가 자료 필요":
      return tr("rule.rulestatus.needMore");
    case "현재 정보로 판단 불가":
      return tr("rule.rulestatus.unknown");
    case "대상 후보":
      return tr("rule.rulestatus.candidate");
    default:
      return status;
  }
}

export const STATUS_TONE: Record<PayCheckStatus, "ok" | "warn" | "info" | "neutral"> = {
  MATCH: "ok",
  EXPLANATION_REQUIRED: "warn",
  INSUFFICIENT_DATA: "neutral",
  USER_CONFIRMATION: "info",
};

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function expectedNet(f: DocFields | undefined): number | null {
  if (!f) return null;
  if (num(f.netPay) !== null) return f.netPay;
  const base = num(f.basePay);
  if (base === null) return null;
  return base + (num(f.allowances) ?? 0) - (num(f.deductions) ?? 0);
}

function cell(v: number | null | undefined, placeholder?: string): string {
  if (v === null || v === undefined) {
    return placeholder !== undefined ? placeholder : tr("rule.common.noData");
  }
  return won(v);
}

const docName = (kind: "contract" | "statement" | "deposit"): string => tr(`rule.doc.${kind}`);

/** 3중 대조: 계약서 ↔ 명세서 ↔ 입금내역 */
export function analyzePaycheck(
  documents: PayDocuments,
  employment: EmploymentProfile | null,
  period: string,
): PaycheckAnalysis {
  const c = documents.contract?.fields;
  const s = documents.statement?.fields;
  const d = documents.deposit?.fields;

  const contractNet = expectedNet(c);
  const statementNet = expectedNet(s);
  const depositNet = num(d?.netPay);

  const rows: ComparisonRow[] = [];
  const findings: PayFinding[] = [];

  const pushRow = (
    item: string,
    values: [number | null | undefined, number | null | undefined, number | null | undefined],
    result: string,
    status: PayCheckStatus,
    placeholders: [string?, string?, string?] = [],
  ) => {
    rows.push({
      item,
      contract: cell(values[0], placeholders[0]),
      statement: cell(values[1], placeholders[1]),
      deposit: cell(values[2], placeholders[2]),
      result,
      status,
    });
  };

  /* 1. 기본급 */
  const baseDiff = compare(num(c?.basePay), num(s?.basePay));
  pushRow(tr("rule.row.base"), [c?.basePay, s?.basePay, null], baseDiff.text, baseDiff.status, [undefined, undefined, "-"]);
  if (baseDiff.status === "EXPLANATION_REQUIRED") {
    findings.push({
      id: "base",
      status: "EXPLANATION_REQUIRED",
      title: tr("rule.finding.base.title"),
      fact: tr("rule.finding.base.fact", {
        contract: won(c?.basePay),
        statement: won(s?.basePay),
        diff: won(Math.abs(baseDiff.diff)),
      }),
      standard: tr("rule.finding.base.standard"),
      limitation: tr("rule.finding.base.limitation"),
      nextActions: [
        tr("rule.finding.base.next1"),
        tr("rule.finding.base.next2"),
        tr("rule.finding.base.next3"),
      ],
      comparison: tr("rule.finding.base.comparison"),
      left: { label: tr("rule.finding.base.left"), amount: num(c?.basePay) },
      right: { label: tr("rule.finding.base.right"), amount: num(s?.basePay) },
      difference: baseDiff.diff,
      requiredEvidence: [tr("rule.finding.base.evidence1"), tr("rule.finding.base.evidence2")],
      sources: [docName("contract"), docName("statement")],
      evidence: [LAW.contractTerms, LAW.payslip],
    });
  }

  /* 2. 수당 */
  pushRow(
    tr("rule.row.allowance"),
    [c?.allowances, s?.allowances, null],
    num(s?.allowances) === null ? tr("rule.row.allowance.unconfirmed") : tr("rule.row.allowance.confirmed"),
    num(s?.allowances) === null ? "INSUFFICIENT_DATA" : "MATCH",
    ["-", undefined, "-"],
  );

  /* 3. 공제 */
  const deduction = num(s?.deductions);
  const deductionRatio =
    deduction !== null && statementNet !== null && statementNet + deduction > 0
      ? deduction / (statementNet + deduction)
      : null;
  pushRow(
    tr("rule.row.deduction"),
    [c?.deductions, s?.deductions, null],
    deduction === null
      ? tr("rule.row.deduction.unconfirmed")
      : deductionRatio !== null && deductionRatio > 0.25
        ? tr("rule.row.deduction.highRatio")
        : tr("rule.row.deduction.confirmed"),
    deduction === null
      ? "INSUFFICIENT_DATA"
      : deductionRatio !== null && deductionRatio > 0.25
        ? "USER_CONFIRMATION"
        : "MATCH",
    ["-", undefined, "-"],
  );
  if (deduction !== null && deductionRatio !== null && deductionRatio > 0.25) {
    findings.push({
      id: "deduction",
      status: "USER_CONFIRMATION",
      title: tr("rule.finding.deduction.title"),
      fact: tr("rule.finding.deduction.fact", {
        amount: won(deduction),
        percent: Math.round(deductionRatio * 100),
      }),
      standard: tr("rule.finding.deduction.standard"),
      limitation: tr("rule.finding.deduction.limitation"),
      nextActions: [
        tr("rule.finding.deduction.next1"),
        tr("rule.finding.deduction.next2"),
        tr("rule.finding.deduction.next3"),
      ],
      comparison: tr("rule.finding.deduction.comparison"),
      left: { label: tr("rule.finding.deduction.left"), amount: deduction },
      right: {
        label: tr("rule.finding.deduction.right"),
        amount: statementNet !== null ? statementNet + deduction : null,
      },
      difference: deduction,
      requiredEvidence: [tr("rule.finding.deduction.evidence1"), tr("rule.finding.deduction.evidence2")],
      sources: [docName("statement")],
      evidence: [LAW.wageFull, LAW.payslip],
    });
  }

  /* 4. 실지급액: 명세서 ↔ 입금내역 */
  const netDiff = compare(statementNet, depositNet);
  pushRow(tr("rule.row.net"), [contractNet, statementNet, depositNet], netDiff.text, netDiff.status);
  if (netDiff.status === "EXPLANATION_REQUIRED") {
    findings.push({
      id: "net",
      status: "EXPLANATION_REQUIRED",
      title: tr("rule.finding.net.title"),
      fact: tr("rule.finding.net.fact", {
        statement: won(statementNet),
        deposit: won(depositNet),
        diff: won(Math.abs(netDiff.diff)),
      }),
      standard: tr("rule.finding.net.standard"),
      limitation: tr("rule.finding.net.limitation"),
      nextActions: [
        tr("rule.finding.net.next1"),
        tr("rule.finding.net.next2"),
        tr("rule.finding.net.next3"),
      ],
      comparison: tr("rule.finding.net.comparison"),
      left: { label: tr("rule.finding.net.left"), amount: statementNet },
      right: { label: tr("rule.finding.net.right"), amount: depositNet },
      difference: netDiff.diff,
      requiredEvidence: [tr("rule.finding.net.evidence1"), tr("rule.finding.net.evidence2")],
      sources: [docName("statement"), docName("deposit")],
      evidence: [LAW.wageFull],
    });
  }

  /* 5. 계약 ↔ 입금 (명세서 없이도 확인 가능한 경로) */
  if (contractNet !== null && depositNet !== null && statementNet === null) {
    const cd = compare(contractNet, depositNet);
    if (cd.status === "EXPLANATION_REQUIRED") {
      findings.push({
        id: "contract-deposit",
        status: "EXPLANATION_REQUIRED",
        title: tr("rule.finding.contractDeposit.title"),
        fact: tr("rule.finding.contractDeposit.fact", {
          contract: won(contractNet),
          deposit: won(depositNet),
          diff: won(Math.abs(cd.diff)),
        }),
        standard: "근로기준법 제17조·제43조",
        limitation: tr("rule.finding.contractDeposit.limitation"),
        nextActions: [tr("rule.finding.contractDeposit.next1"), tr("rule.finding.contractDeposit.next2")],
        comparison: tr("rule.finding.contractDeposit.comparison"),
        left: { label: tr("rule.finding.contractDeposit.left"), amount: contractNet },
        right: { label: tr("rule.finding.contractDeposit.right"), amount: depositNet },
        difference: cd.diff,
        requiredEvidence: [docName("statement")],
        sources: [docName("contract"), docName("deposit")],
        evidence: [LAW.contractTerms, LAW.payslip],
      });
    }
  }

  /* 6. 지급일 */
  const payDay = num(c?.payDay) ?? employment?.payDay ?? null;
  const payDate = d?.payDate ?? null;
  let dateResult = tr("rule.row.payDate.insufficient");
  let dateStatus: PayCheckStatus = "INSUFFICIENT_DATA";
  if (payDay !== null && payDate) {
    const actualDay = Number(payDate.slice(8, 10));
    const delay = actualDay - payDay;
    if (delay <= 0) {
      dateResult = tr("rule.row.payDate.onTime", { payDay, date: formatKDate(payDate) });
      dateStatus = "MATCH";
    } else {
      dateResult = tr("rule.row.payDate.late", { payDay, delay });
      dateStatus = "EXPLANATION_REQUIRED";
      findings.push({
        id: "paydate",
        status: "EXPLANATION_REQUIRED",
        title: tr("rule.finding.paydate.title"),
        fact: tr("rule.finding.paydate.fact", { payDay, date: formatKDate(payDate) }),
        standard: tr("rule.finding.paydate.standard"),
        limitation: tr("rule.finding.paydate.limitation"),
        nextActions: [tr("rule.finding.paydate.next1"), tr("rule.finding.paydate.next2")],
        comparison: tr("rule.finding.paydate.comparison"),
        left: { label: tr("rule.finding.paydate.left"), amount: payDay },
        right: { label: tr("rule.finding.paydate.right"), amount: actualDay },
        difference: delay,
        requiredEvidence: [tr("rule.finding.paydate.evidence1")],
        sources: [docName("contract"), docName("deposit")],
        evidence: [LAW.wageFull],
      });
    }
  }
  rows.push({
    item: tr("rule.row.payDate"),
    contract: payDay ? tr("rule.row.payDate.contractLabel", { payDay }) : "-",
    statement: s?.payDate ? formatKDate(s.payDate) : "-",
    deposit: payDate ? formatKDate(payDate) : "-",
    result: dateResult,
    status: dateStatus,
  });

  /* 7. 최저임금 참고 비교 (월 209시간 환산) */
  const monthlyBase = num(c?.basePay) ?? num(s?.basePay);
  if (monthlyBase !== null && monthlyBase < MIN_WAGE.monthly209) {
    findings.push({
      id: "minwage",
      status: "USER_CONFIRMATION",
      title: tr("rule.finding.minwage.title"),
      fact: tr("rule.finding.minwage.fact", {
        base: won(monthlyBase),
        year: MIN_WAGE.year,
        hourly: MIN_WAGE.hourly.toLocaleString("ko-KR"),
        monthly: won(MIN_WAGE.monthly209),
      }),
      standard: tr("rule.finding.minwage.standard"),
      limitation: tr("rule.finding.minwage.limitation"),
      nextActions: [tr("rule.finding.minwage.next1"), tr("rule.finding.minwage.next2")],
      comparison: tr("rule.finding.minwage.comparison"),
      left: { label: tr("rule.finding.minwage.left"), amount: monthlyBase },
      right: { label: tr("rule.finding.minwage.right"), amount: MIN_WAGE.monthly209 },
      difference: monthlyBase - MIN_WAGE.monthly209,
      requiredEvidence: [tr("rule.finding.minwage.evidence1"), tr("rule.finding.minwage.evidence2")],
      sources: [docName("contract")],
      evidence: [LAW.minWage],
    });
  }

  /* 부족 자료 */
  const missing: string[] = [];
  if (!documents.contract) missing.push(docName("contract"));
  if (!documents.statement) missing.push(docName("statement"));
  if (!documents.deposit) missing.push(docName("deposit"));
  if (missing.length > 0) {
    findings.push({
      id: "missing",
      status: "INSUFFICIENT_DATA",
      title: tr("rule.finding.missing.title", { docs: missing.join(", ") }),
      fact: tr("rule.finding.missing.fact", { count: 3 - missing.length }),
      standard: tr("rule.finding.missing.standard"),
      limitation: tr("rule.finding.missing.limitation"),
      nextActions: missing.map((m) => tr("rule.finding.missing.next", { doc: m })),
      comparison: tr("rule.finding.missing.comparison"),
      left: { label: tr("rule.finding.missing.left"), amount: 3 - missing.length },
      right: { label: tr("rule.finding.missing.right"), amount: 3 },
      difference: missing.length,
      requiredEvidence: missing,
      sources: [],
      evidence: [LAW.payslip],
    });
  }

  const overallStatus: PayCheckStatus = findings.some((f) => f.status === "EXPLANATION_REQUIRED")
    ? "EXPLANATION_REQUIRED"
    : findings.some((f) => f.status === "USER_CONFIRMATION")
      ? "USER_CONFIRMATION"
      : missing.length > 0
        ? "INSUFFICIENT_DATA"
        : "MATCH";

  const headline: Record<PayCheckStatus, string> = {
    MATCH: tr("rule.headline.MATCH", { month: monthLabel(period) }),
    EXPLANATION_REQUIRED: tr("rule.headline.EXPLANATION_REQUIRED", { month: monthLabel(period) }),
    INSUFFICIENT_DATA: tr("rule.headline.INSUFFICIENT_DATA", { month: monthLabel(period) }),
    USER_CONFIRMATION: tr("rule.headline.USER_CONFIRMATION", { month: monthLabel(period) }),
  };

  const allConfirmed = Object.values(documents).every((doc) => doc?.confirmed);

  const steps: PaycheckAnalysis["steps"] = [
    {
      label: tr("rule.step.detect"),
      ok: Object.keys(documents).length > 0,
      detail: tr("rule.step.detect.detail", { count: Object.keys(documents).length }),
    },
    {
      label: tr("rule.step.confirm"),
      ok: allConfirmed,
      detail: allConfirmed ? tr("rule.step.confirm.ok") : tr("rule.step.confirm.pending"),
    },
    {
      label: tr("rule.step.compare"),
      ok: true,
      detail: tr("rule.step.compare.detail", { count: rows.length }),
    },
    {
      label: tr("rule.step.summarize"),
      ok: true,
      detail: tr("rule.step.summarize.detail", { count: findings.length }),
    },
  ];

  return {
    rows,
    findings,
    overallStatus,
    headline: headline[overallStatus],
    detail: overallStatus === "MATCH" ? tr("rule.detail.match") : tr("rule.detail.other"),
    steps,
  };
}

function compare(a: number | null, b: number | null) {
  if (a === null || b === null) {
    return { status: "INSUFFICIENT_DATA" as PayCheckStatus, diff: 0, text: tr("rule.compare.insufficient") };
  }
  const diff = b - a;
  if (Math.abs(diff) <= TOLERANCE) {
    return { status: "MATCH" as PayCheckStatus, diff, text: tr("rule.compare.match") };
  }
  return {
    status: "EXPLANATION_REQUIRED" as PayCheckStatus,
    diff,
    text:
      diff < 0
        ? tr("rule.compare.diffLess", { amount: won(Math.abs(diff)) })
        : tr("rule.compare.diffMore", { amount: won(Math.abs(diff)) }),
  };
}

/* --------------------------------- TaxCheck -------------------------------- */

export function monthsWorked(employment: EmploymentProfile | null, at = new Date()): number | null {
  const start = employment?.workStartDate;
  if (!start || start.unknown || !start.value) return null;
  const [y, m, d] = start.value.split("-").map(Number) as [number, number, number];
  const months =
    (at.getFullYear() - y) * 12 + (at.getMonth() + 1 - m) + (at.getDate() >= d ? 0 : -1);
  return Math.max(months, 0);
}

export function daysInKoreaThisYear(employment: EmploymentProfile | null): number | null {
  const entry = employment?.entryDate;
  if (!entry || entry.unknown || !entry.value) return null;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [ey, em, ed] = entry.value.split("-").map(Number) as [number, number, number];
  const entryDt = new Date(ey, em - 1, ed);
  const from = entryDt > yearStart ? entryDt : yearStart;
  return Math.max(daysBetween(from, now), 0);
}

export function evaluateTax(input: {
  employment: EmploymentProfile | null;
  yearlyPay: number;
  monthsRecorded: number;
  taxProfile: TaxProfile;
}): TaxCard[] {
  const { employment, yearlyPay, monthsRecorded, taxProfile } = input;
  const days = daysInKoreaThisYear(employment);
  const cards: TaxCard[] = [];

  /* 1. 거주자 판정 */
  const residentStatus: RuleStatus =
    days === null ? "현재 정보로 판단 불가" : days >= 183 ? "적용 가능성 있음" : "추가 자료 필요";
  cards.push({
    id: "resident",
    title: tr("rule.tax.resident.title"),
    status: residentStatus,
    summary:
      days === null
        ? tr("rule.tax.resident.summary.unknown")
        : tr("rule.tax.resident.summary.known", { days }),
    confirmed: [
      tr("rule.tax.resident.confirmed1", {
        date: employment?.entryDate?.value
          ? formatKDate(employment.entryDate.value)
          : tr("rule.common.notEntered"),
      }),
      days === null ? tr("rule.tax.resident.confirmed2.unknown") : tr("rule.tax.resident.confirmed2.known", { days }),
    ],
    missing: days === null ? [tr("rule.tax.resident.missing.entry")] : days >= 183 ? [] : [tr("rule.tax.resident.missing.proof")],
    nextActions:
      days !== null && days < 183
        ? [tr("rule.tax.resident.next.proof")]
        : [tr("rule.tax.resident.next.confirm")],
    evidence: [LAW.yearEndSettlement],
  });

  /* 2. 주택청약저축 소득공제 */
  const housing = taxProfile.housingSaving;
  const housingStatus: RuleStatus =
    housing === null
      ? "현재 정보로 판단 불가"
      : housing === false
        ? "조건 미충족"
        : taxProfile.isHomeless !== true
          ? "추가 자료 필요"
          : taxProfile.housingSavingProof !== true
            ? "추가 자료 필요"
            : "적용 가능성 있음";
  cards.push({
    id: "housing",
    title: tr("rule.tax.housing.title"),
    status: housingStatus,
    summary: housing === false ? tr("rule.tax.housing.summary.no") : tr("rule.tax.housing.summary.yes"),
    confirmed: [
      tr("rule.tax.housing.confirmed1", {
        value: housing === null ? tr("rule.common.unanswered") : housing ? tr("rule.common.yes") : tr("rule.common.no"),
      }),
      tr("rule.tax.housing.confirmed2", {
        value:
          taxProfile.isHomeless === null
            ? tr("rule.common.unanswered")
            : taxProfile.isHomeless
              ? tr("rule.tax.housing.homeless.yes")
              : tr("rule.tax.housing.homeless.no"),
      }),
      tr("rule.tax.housing.confirmed3", { amount: won(yearlyPay), months: monthsRecorded }),
    ],
    missing: [
      ...(taxProfile.isHomeless === null ? [tr("rule.tax.housing.missing.homelessAnswer")] : []),
      ...(housing === true && taxProfile.housingSavingProof !== true ? [tr("rule.tax.housing.missing.proof")] : []),
    ],
    nextActions:
      housing === true
        ? [tr("rule.tax.housing.next1"), tr("rule.tax.housing.next2")]
        : [tr("rule.tax.housing.next.none")],
    evidence: [LAW.housingSaving],
  });

  /* 3. 19% 단일세율 비교 */
  const annualized = monthsRecorded > 0 ? (yearlyPay / monthsRecorded) * 12 : 0;
  const flatTax = annualized * 0.19;
  const flatStatus: RuleStatus =
    monthsRecorded === 0
      ? "현재 정보로 판단 불가"
      : monthsRecorded < 3
        ? "추가 자료 필요"
        : taxProfile.usesDeductions === true
          ? "조건 미충족"
          : "적용 가능성 있음";
  cards.push({
    id: "flat",
    title: tr("rule.tax.flat.title"),
    status: flatStatus,
    summary:
      monthsRecorded === 0
        ? tr("rule.tax.flat.summary.none")
        : tr("rule.tax.flat.summary.calc", { annual: won(annualized), tax: won(flatTax) }),
    confirmed: [
      tr("rule.tax.flat.confirmed1", { months: monthsRecorded, amount: won(yearlyPay) }),
      tr("rule.tax.flat.confirmed2", {
        value: monthsRecorded > 0 ? won(annualized) : tr("rule.tax.flat.value.uncalculable"),
      }),
      tr("rule.tax.flat.confirmed3", {
        value:
          taxProfile.usesDeductions === null
            ? tr("rule.common.unanswered")
            : taxProfile.usesDeductions
              ? tr("rule.common.yes")
              : tr("rule.common.no"),
      }),
    ],
    missing: monthsRecorded < 3 ? [tr("rule.tax.flat.missing.months")] : [],
    nextActions: [tr("rule.tax.flat.next1"), tr("rule.tax.flat.next2")],
    evidence: [LAW.flatRate],
  });

  return cards;
}

/* -------------------------------- ExitCheck -------------------------------- */

export function evaluateExit(input: {
  employment: EmploymentProfile | null;
  exitProfile: ExitProfile;
  totalMonths: number | null;
}): ExitClaim[] {
  const { employment, exitProfile, totalMonths } = input;
  const visaBased = totalMonths !== null;
  const over12 = totalMonths !== null && totalMonths >= 12;

  const claims: ExitClaim[] = [];

  claims.push({
    id: "departure-insurance",
    title: tr("rule.exit.departure.title"),
    status:
      exitProfile.hasInsuranceRecord === null
        ? "현재 정보로 판단 불가"
        : exitProfile.hasInsuranceRecord === false
          ? "추가 자료 필요"
          : over12
            ? "적용 가능성 있음"
            : "조건 미충족",
    confirmed: [
      totalMonths === null ? tr("rule.exit.confirmed.monthsUnknown") : tr("rule.exit.confirmed.months", { months: totalMonths }),
      tr("rule.exit.departure.confirmed2", {
        value:
          exitProfile.hasInsuranceRecord === null
            ? tr("rule.common.unanswered")
            : exitProfile.hasInsuranceRecord
              ? tr("rule.common.yes")
              : tr("rule.exit.value.notChecked"),
      }),
    ],
    missing: [
      ...(exitProfile.hasInsuranceRecord !== true ? [tr("rule.exit.departure.missing.insurance")] : []),
      ...(exitProfile.hasOwnAccount !== true ? [tr("rule.exit.departure.missing.ownAccount")] : []),
    ],
    documents: [
      tr("rule.doc.passport"),
      tr("rule.doc.arc"),
      tr("rule.doc.bankCopy"),
      tr("rule.doc.exitProof"),
    ],
    nextAction: over12 ? tr("rule.exit.departure.next.over12") : tr("rule.exit.departure.next.under12"),
    evidence: [LAW.departureInsurance],
  });

  claims.push({
    id: "return-cost",
    title: tr("rule.exit.returnCost.title"),
    status: visaBased ? "대상 후보" : "현재 정보로 판단 불가",
    confirmed: [
      tr("rule.exit.returnCost.confirmed1"),
      tr("rule.exit.returnCost.confirmed2", {
        date: employment?.exitDate?.value ? formatKDate(employment.exitDate.value) : tr("rule.common.notEntered"),
      }),
    ],
    missing: exitProfile.hasExitProof === true ? [] : [tr("rule.exit.returnCost.missing.proof")],
    documents: [tr("rule.doc.passport"), tr("rule.doc.ticket"), tr("rule.doc.bankCopy")],
    nextAction: tr("rule.exit.returnCost.next"),
    evidence: [LAW.returnCostInsurance],
  });

  claims.push({
    id: "pension",
    title: tr("rule.exit.pension.title"),
    status:
      exitProfile.pensionDeducted === null
        ? "현재 정보로 판단 불가"
        : exitProfile.pensionDeducted === false
          ? "조건 미충족"
          : "추가 자료 필요",
    confirmed: [
      tr("rule.exit.pension.confirmed1", {
        value:
          exitProfile.pensionDeducted === null
            ? tr("rule.common.unanswered")
            : exitProfile.pensionDeducted
              ? tr("rule.common.yes")
              : tr("rule.common.no"),
      }),
      tr("rule.exit.pension.confirmed2"),
    ],
    missing: [tr("rule.exit.pension.missing1"), tr("rule.exit.pension.missing2")],
    documents: [tr("rule.doc.passport"), tr("rule.doc.ticket"), tr("rule.doc.remitAccount")],
    nextAction: tr("rule.exit.pension.next"),
    evidence: [LAW.pensionLumpSum],
  });

  claims.push({
    id: "severance",
    title: tr("rule.exit.severance.title"),
    status: over12
      ? exitProfile.hasRecentPayslip === true
        ? "적용 가능성 있음"
        : "추가 자료 필요"
      : totalMonths === null
        ? "현재 정보로 판단 불가"
        : "조건 미충족",
    confirmed: [
      totalMonths === null
        ? tr("rule.exit.confirmed.monthsUnknown")
        : tr("rule.exit.severance.confirmed1", { months: totalMonths }),
      tr("rule.exit.severance.confirmed2"),
    ],
    missing: exitProfile.hasRecentPayslip === true ? [] : [tr("rule.exit.severance.missing.payslip")],
    documents: [tr("rule.doc.contract"), tr("rule.exit.severance.doc.payslip3"), tr("rule.exit.severance.doc.insurancePayout")],
    nextAction: tr("rule.exit.severance.next"),
    evidence: [LAW.severance, LAW.departureInsurance],
  });

  return claims;
}

export interface RoadmapStep {
  date: string;
  offset: number;
  label: string;
  detail: string;
}

export function exitRoadmap(exitIso: string): RoadmapStep[] {
  const steps: { offset: number; label: string; detail: string }[] = [
    { offset: -45, label: tr("rule.roadmap.step1.label"), detail: tr("rule.roadmap.step1.detail") },
    { offset: -30, label: tr("rule.roadmap.step2.label"), detail: tr("rule.roadmap.step2.detail") },
    { offset: -20, label: tr("rule.roadmap.step3.label"), detail: tr("rule.roadmap.step3.detail") },
    { offset: -14, label: tr("rule.roadmap.step4.label"), detail: tr("rule.roadmap.step4.detail") },
    { offset: -7, label: tr("rule.roadmap.step5.label"), detail: tr("rule.roadmap.step5.detail") },
    { offset: 0, label: tr("rule.roadmap.step6.label"), detail: tr("rule.roadmap.step6.detail") },
  ];
  return steps.map((s) => ({ ...s, date: addDays(exitIso, s.offset) }));
}

export function dDay(exitIso: string): number {
  const [y, m, d] = exitIso.split("-").map(Number) as [number, number, number];
  return daysBetween(new Date(), new Date(y, m - 1, d));
}

export function today(): string {
  return isoDate(new Date());
}
