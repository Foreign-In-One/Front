import { periodOf, uid, isoDate } from "./format";
import type { PayCycleState, PayRecord } from "./types";

function payDayIso(period: string, day: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1, Math.min(day, 28));
  return isoDate(date);
}

export function buildSampleState(): PayCycleState {
  const today = new Date();
  const year = today.getFullYear();

  const p1 = periodOf(new Date(year, today.getMonth() - 1, 1));
  const p2 = periodOf(new Date(year, today.getMonth() - 2, 1));

  const records: PayRecord[] = [
    {
      id: uid("pay"),
      period: p1,
      workplace: "한빛정밀 (제조업)",
      checkedAt: payDayIso(p1, 10),
      paidAmount: 2038330,
      documents: {
        contract: {
          kind: "contract",
          source: "sample",
          fileName: "근로계약서_한빛정밀.png",
          fields: {
            period: p1,
            basePay: 2260000,
            allowances: null,
            deductions: null,
            netPay: null,
            payDay: 10,
            payDate: null,
          },
          confirmed: true,
          masked: true,
          note: "샘플 근로계약서에서 기본급 226만 원, 지급일 10일을 읽었습니다.",
        },
        statement: {
          kind: "statement",
          source: "sample",
          fileName: "급여명세서_한빛.png",
          fields: {
            period: p1,
            basePay: 2260000,
            allowances: null,
            deductions: 221670,
            netPay: 2038330,
            payDay: null,
            payDate: payDayIso(p1, 10),
          },
          confirmed: true,
          masked: true,
          note: "샘플 임금명세서에서 기본급 226만 원, 공제 221,670원, 실지급액 2,038,330원을 읽었습니다.",
        },
        deposit: {
          kind: "deposit",
          source: "sample",
          fileName: "통장입금내역.png",
          fields: {
            period: p1,
            basePay: null,
            allowances: null,
            deductions: null,
            netPay: 2038330,
            payDay: null,
            payDate: payDayIso(p1, 10),
          },
          confirmed: true,
          masked: true,
          note: "샘플 입금내역에서 2,038,330원 입금을 확인했습니다.",
        },
      },
      analysis: {
        overallStatus: "MATCH",
        headline: "계약서·명세서·입금액이 모두 일치합니다",
        detail:
          "근로계약서 기본급 2,260,000원이 임금명세서에 그대로 반영되었고, 공제 후 실지급액 2,038,330원이 정상 입금되었습니다.",
        steps: [
          { label: "문서 모으기", ok: true, detail: "계약서, 명세서, 입금내역 연동" },
          { label: "계약 - 명세 대조", ok: true, detail: "기본급 2,260,000원 일치" },
          { label: "명세 - 입금 대조", ok: true, detail: "실지급액 2,038,330원 일치" },
        ],
        findings: [],
        rows: [
          {
            item: "기본급",
            contract: "2,260,000원",
            statement: "2,260,000원",
            deposit: "—",
            result: "동일",
            status: "MATCH",
          },
          {
            item: "공제",
            contract: "—",
            statement: "221,670원",
            deposit: "—",
            result: "정상 범위",
            status: "MATCH",
          },
          {
            item: "실지급/입금액",
            contract: "—",
            statement: "2,038,330원",
            deposit: "2,038,330원",
            result: "동일",
            status: "MATCH",
          },
        ],
      },
    },
  ];

  return {
    profile: {
      nickname: "알렉스 (Alex)",
      nationality: "베트남",
      visa: "E-9 (비전문취업)",
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
        type: "PAYCHECK" as const,
        date: payDayIso(r.period, 10),
        category: "급여" as const,
        source: "paycheck" as const,
        title: "급여 입금",
        description: `${r.workplace} · 확인 완료`,
        amount: r.paidAmount ?? 0,
        auto: true,
        kind: "확정" as const,
      })),
      {
        id: uid("ev"),
        type: "TAX" as const,
        date: `${year}-01-25`,
        category: "세금" as const,
        source: "taxcheck" as const,
        title: "연말정산 서류 제출 기한",
        description: "회사 연말정산 담당자에게 공제 서류 제출",
        auto: true,
        kind: "권장" as const,
      },
      {
        id: uid("ev"),
        type: "PERSONAL" as const,
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
