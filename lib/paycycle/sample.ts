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
      paidAmount: 2450000,
      documents: {
        contract: {
          kind: "contract",
          source: "sample",
          fileName: "근로계약서_한빛정밀.png",
          fields: {
            period: p1,
            basePay: 2100000,
            allowances: 400000,
            deductions: null,
            netPay: null,
            payDay: 10,
            payDate: null,
          },
          confirmed: true,
          masked: true,
          note: "샘플 근로계약서에서 월 250만 원, 지급일 10일을 읽었습니다.",
        },
        statement: {
          kind: "statement",
          source: "sample",
          fileName: "급여명세서_한빛.png",
          fields: {
            period: p1,
            basePay: 2100000,
            allowances: 400000,
            deductions: 250000,
            netPay: 2250000,
            payDay: null,
            payDate: payDayIso(p1, 10),
          },
          confirmed: true,
          masked: true,
          note: "샘플 임금명세서에서 차인지급액 225만 원을 읽었습니다.",
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
            netPay: 2450000,
            payDay: null,
            payDate: payDayIso(p1, 10),
          },
          confirmed: true,
          masked: true,
          note: "샘플 입금내역에서 245만 원 입금을 확인했습니다.",
        },
      },
      analysis: {
        overallStatus: "EXPLANATION_REQUIRED",
        headline: "입금액 245만 원이 명세서(225만 원)보다 20만 원 큽니다",
        detail:
          "명세서에 기록되지 않은 현금 수당이나 별도 지급액인지 확인이 필요합니다.",
        steps: [
          { label: "문서 모으기", ok: true, detail: "계약서, 명세서, 입금내역 연동" },
          { label: "계약 - 명세 대조", ok: true, detail: "총지급액 250만 원 일치" },
          { label: "명세 - 입금 대조", ok: false, detail: "20만 원 차이 발생" },
        ],
        findings: [
          {
            id: uid("f"),
            status: "EXPLANATION_REQUIRED",
            title: "명세서 실지급액과 입금액 차이",
            fact: `임금명세서의 차인지급액은 2,250,000원이지만, 통장 입금액은 2,450,000원으로 200,000원 차이가 납니다.`,
            standard:
              "근로기준법 제43조: 임금은 전액을 통화로 직접 근로자에게 지급해야 합니다.",
            limitation:
              "이 차이는 상여금·가불 정산·별도 수당일 수 있으며 위법을 단정하지 않습니다.",
            nextActions: [
              "사업주나 담당자에게 20만 원의 구체적인 지급 항목을 정중하게 물어보세요.",
              "추가 수당 명목이라면 다음 달 명세서에 항목 반영을 요청하세요.",
            ],
            comparison: "EXPLANATION_REQUIRED",
            left: { label: "임금명세서 차인지급액", amount: 2250000 },
            right: { label: "통장 실입금액", amount: 2450000 },
            difference: 200000,
            requiredEvidence: [
              "이달 임금명세서",
              "입금된 은행 계좌 거래내역",
            ],
            sources: ["statement", "deposit"],
            evidence: [],
          },
        ],
        rows: [
          {
            item: "기본급",
            contract: "2,100,000원",
            statement: "2,100,000원",
            deposit: "—",
            result: "동일",
            status: "MATCH",
          },
          {
            item: "고정수당",
            contract: "400,000원",
            statement: "400,000원",
            deposit: "—",
            result: "동일",
            status: "MATCH",
          },
          {
            item: "실지급/입금액",
            contract: "—",
            statement: "2,250,000원",
            deposit: "2,450,000원",
            result: "+200,000원 차이",
            status: "EXPLANATION_REQUIRED",
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
