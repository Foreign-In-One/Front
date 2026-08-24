import type { PayCycleState, PayDocuments, PayRecord } from "./types";
import { analyzePaycheck } from "./rule-engine";
import { isoDate, payDayIso, periodOf, uid } from "./format";

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return periodOf(d);
}

function docs(period: string, netPay: number, deposit: number): PayDocuments {
  return {
    contract: {
      kind: "contract",
      source: "sample",
      fileName: "근로계약서_샘플.jpg",
      confirmed: true,
      masked: true,
      note: "샘플 데이터",
      fields: {
        basePay: 2_200_000,
        allowances: 150_000,
        deductions: null,
        netPay: null,
        payDay: 10,
        payDate: null,
        period,
      },
    },
    statement: {
      kind: "statement",
      source: "sample",
      fileName: "임금명세서_샘플.jpg",
      confirmed: true,
      masked: true,
      note: "샘플 데이터",
      fields: {
        basePay: 2_200_000,
        allowances: 150_000,
        deductions: 2_350_000 - netPay,
        netPay,
        payDay: null,
        payDate: payDayIso(period, 10),
        period,
      },
    },
    deposit: {
      kind: "deposit",
      source: "sample",
      fileName: "입금내역_샘플.jpg",
      confirmed: true,
      masked: true,
      note: "샘플 데이터",
      fields: {
        basePay: null,
        allowances: null,
        deductions: null,
        netPay: deposit,
        payDay: null,
        payDate: payDayIso(period, deposit === netPay ? 10 : 13),
        period,
      },
    },
  };
}

function record(period: string, netPay: number, deposit: number): PayRecord {
  const documents = docs(period, netPay, deposit);
  return {
    id: uid("pay"),
    period,
    workplace: "한빛정밀 (제조업)",
    checkedAt: payDayIso(period, 11),
    paidAmount: deposit,
    documents,
    analysis: analyzePaycheck(documents, null, period),
  };
}

/** 클릭 한 번으로 전체 흐름을 볼 수 있는 샘플 데이터 */
export function buildSampleState(): PayCycleState {
  const year = new Date().getFullYear();
  const records = [
    record(monthsAgo(2), 2_090_000, 2_090_000),
    record(monthsAgo(1), 2_090_000, 2_090_000),
    record(monthsAgo(0), 2_090_000, 1_970_000),
  ];

  return {
    profile: {
      nickname: "흐엉",
      nationality: "베트남",
      visa: "E-9",
      language: "vi",
    },
    employment: {
      status: "EMPLOYED",
      entryDate: { value: `${year - 2}-03-12`, unknown: false },
      workStartDate: { value: `${year - 2}-04-01`, unknown: false },
      currentWorkplaceStartDate: { value: `${year - 1}-05-01`, unknown: false },
      exitDate: { value: `${year + 1}-03-31`, unknown: false },
      payDay: 10,
      workplace: "한빛정밀 (제조업)",
      previousWorkplace: "대성산업 (금속가공)",
    },
    payRecords: records,
    events: [
      ...records.map((r) => ({
        id: uid("ev"),
        date: payDayIso(r.period, 10),
        category: "급여" as const,
        source: "paycheck" as const,
        title: "급여 입금",
        detail: `${r.workplace} · 확인 완료`,
        amount: r.paidAmount ?? 0,
        auto: true,
        kind: "확정" as const,
      })),
      {
        id: uid("ev"),
        date: `${year}-01-25`,
        category: "세금" as const,
        source: "taxcheck" as const,
        title: "연말정산 서류 제출 기한",
        detail: "회사 연말정산 담당자에게 공제 서류 제출",
        auto: true,
        kind: "권장" as const,
      },
      {
        id: uid("ev"),
        date: isoDate(new Date()),
        category: "프로필" as const,
        source: "profile" as const,
        title: "샘플 체험 데이터 불러옴",
        auto: true,
        kind: "확정" as const,
      },
    ],
    taxProfile: {
      housingSaving: true,
      housingSavingProof: false,
      isHomeless: true,
      usesDeductions: false,
    },
    exitProfile: {
      hasInsuranceRecord: true,
      pensionDeducted: true,
      hasExitProof: false,
      hasRecentPayslip: true,
      hasOwnAccount: true,
    },
    sampleMode: true,
  };
}
