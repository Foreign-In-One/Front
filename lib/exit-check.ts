/** EXIT_CHECK(ERD) 대응: 규칙 기반 출국 전 정산 판정. */

export interface ExitAnswers {
  hasInsuranceRecord: boolean | null;
  pensionDeducted: boolean | null;
  hasExitProof: boolean | null;
  hasRecentPayslip: boolean | null;
  hasOwnAccount: boolean | null;
}

export const EMPTY_EXIT_ANSWERS: ExitAnswers = {
  hasInsuranceRecord: null,
  pensionDeducted: null,
  hasExitProof: null,
  hasRecentPayslip: null,
  hasOwnAccount: null,
};

export type RuleStatus =
  | '적용 가능성 있음'
  | '조건 미충족'
  | '추가 자료 필요'
  | '현재 정보로 판단 불가'
  | '대상 후보';

export interface EvidenceSource {
  title: string;
  url: string;
}

export interface ExitClaim {
  id: 'departure-insurance' | 'return-cost' | 'pension' | 'severance';
  title: string;
  status: RuleStatus;
  confirmed: string[];
  missing: string[];
  documents: string[];
  nextAction: string;
  evidence: EvidenceSource[];
}

const LAW = {
  severance: {
    title: '근로자퇴직급여 보장법 제8조',
    url: 'https://www.law.go.kr/법령/근로자퇴직급여보장법/제8조',
  },
  departureInsurance: {
    title: '외국인근로자의 고용 등에 관한 법률 제13조',
    url: 'https://www.law.go.kr/법령/외국인근로자의고용등에관한법률/제13조',
  },
  returnCostInsurance: {
    title: '외국인근로자의 고용 등에 관한 법률 제15조',
    url: 'https://www.law.go.kr/법령/외국인근로자의고용등에관한법률/제15조',
  },
  pensionLumpSum: {
    title: '국민연금법 제77조',
    url: 'https://www.law.go.kr/법령/국민연금법/제77조',
  },
} as const satisfies Record<string, EvidenceSource>;

const yesNo = (value: boolean | null, notCheckedLabel = '확인 안 됨') =>
  value === null ? '미응답' : value ? '예' : notCheckedLabel;

/** 근무 시작일 기준 총 근속 개월수. 미등록이면 null. */
export function monthsWorked(workStart: string): number | null {
  if (!workStart) return null;
  const [y, m, d] = workStart.split('-').map(Number);
  const now = new Date();
  const months =
    (now.getFullYear() - y) * 12 +
    (now.getMonth() + 1 - m) +
    (now.getDate() >= d ? 0 : -1);
  return Math.max(months, 0);
}

export function evaluateExit(input: {
  totalMonths: number | null;
  exitDate: string;
  answers: ExitAnswers;
}): ExitClaim[] {
  const { totalMonths, exitDate, answers } = input;
  const over12 = totalMonths !== null && totalMonths >= 12;
  const monthsConfirmed =
    totalMonths === null
      ? '근속 개월수를 확인할 수 없습니다.'
      : `총 근속 개월수: 약 ${totalMonths}개월`;

  const claims: ExitClaim[] = [];

  claims.push({
    id: 'departure-insurance',
    title: '출국만기보험',
    status:
      answers.hasInsuranceRecord === null
        ? '현재 정보로 판단 불가'
        : answers.hasInsuranceRecord === false
          ? '추가 자료 필요'
          : over12
            ? '적용 가능성 있음'
            : '조건 미충족',
    confirmed: [
      monthsConfirmed,
      `출국만기보험 가입 확인: ${yesNo(answers.hasInsuranceRecord)}`,
    ],
    missing: [
      ...(answers.hasInsuranceRecord !== true
        ? ['출국만기보험 가입 여부 확인 필요']
        : []),
      ...(answers.hasOwnAccount !== true ? ['본인 명의 계좌 확인 필요'] : []),
    ],
    documents: ['여권', '외국인등록증', '통장 사본', '출국 증빙'],
    nextAction: over12
      ? '12개월 이상 근무했으므로 보험금 청구 절차를 준비하세요.'
      : '12개월 미만 근무 시 조건을 다시 확인하세요.',
    evidence: [LAW.departureInsurance],
  });

  claims.push({
    id: 'return-cost',
    title: '귀국비용보험',
    status: totalMonths !== null ? '대상 후보' : '현재 정보로 판단 불가',
    confirmed: [
      '귀국비용보험은 사업주가 가입한 보험입니다.',
      `예상 출국일: ${exitDate ? exitDate.replaceAll('-', '. ').concat('.') : '미입력'}`,
    ],
    missing: answers.hasExitProof === true ? [] : ['출국 증빙 서류 필요'],
    documents: ['여권', '항공권', '통장 사본'],
    nextAction: '출국 전 보험 가입 여부를 사업주에게 확인하세요.',
    evidence: [LAW.returnCostInsurance],
  });

  claims.push({
    id: 'pension',
    title: '국민연금 반환일시금',
    status:
      answers.pensionDeducted === null
        ? '현재 정보로 판단 불가'
        : answers.pensionDeducted === false
          ? '조건 미충족'
          : '추가 자료 필요',
    confirmed: [
      `국민연금 공제 여부: ${yesNo(answers.pensionDeducted, '아니오')}`,
      '반환일시금은 출국 후 청구할 수 있습니다.',
    ],
    missing: ['국민연금 납부확인서 필요', '출국 확인 서류 필요'],
    documents: ['여권', '항공권', '송금 계좌'],
    nextAction: '국민연금공단에 반환일시금을 신청하세요.',
    evidence: [LAW.pensionLumpSum],
  });

  claims.push({
    id: 'severance',
    title: '퇴직금 차액',
    status: over12
      ? answers.hasRecentPayslip === true
        ? '적용 가능성 있음'
        : '추가 자료 필요'
      : totalMonths === null
        ? '현재 정보로 판단 불가'
        : '조건 미충족',
    confirmed: [monthsConfirmed, '퇴직금은 1년 이상 근무 시 발생합니다.'],
    missing: answers.hasRecentPayslip === true ? [] : ['최근 임금명세서 필요'],
    documents: ['근로계약서', '최근 3개월 임금명세서', '보험금 지급 내역'],
    nextAction:
      '최근 3개월 임금명세서로 평균임금을 계산해 퇴직금을 확인하세요.',
    evidence: [LAW.severance, LAW.departureInsurance],
  });

  return claims;
}

export interface RoadmapStep {
  date: string;
  label: string;
  detail: string;
}

function addDays(dateValue: string, offset: number): string {
  const [y, m, d] = dateValue.split('-').map(Number);
  const date = new Date(y, m - 1, d + offset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function exitRoadmap(exitIso: string): RoadmapStep[] {
  const steps = [
    {
      offset: -45,
      label: '출국 준비 시작',
      detail: '출국 45일 전, 출국 계획을 세우세요.',
    },
    {
      offset: -30,
      label: '서류 준비',
      detail: '출국 30일 전, 필요한 서류를 준비하세요.',
    },
    {
      offset: -20,
      label: '정산 요청',
      detail: '출국 20일 전, 사업주에게 정산을 요청하세요.',
    },
    {
      offset: -14,
      label: '보험금 청구 준비',
      detail: '출국 14일 전, 보험금 청구를 준비하세요.',
    },
    {
      offset: -7,
      label: '최종 확인',
      detail: '출국 7일 전, 최종 확인을 하세요.',
    },
    {
      offset: 0,
      label: '출국일',
      detail: '출국일, 공항에서 서류를 제출하세요.',
    },
  ];
  return steps.map((s) => ({
    date: addDays(exitIso, s.offset),
    label: s.label,
    detail: s.detail,
  }));
}

const EXIT_ANSWERS_KEY = 'paycycle:exitAnswers';

export function readExitAnswers(): ExitAnswers {
  try {
    const raw = localStorage.getItem(EXIT_ANSWERS_KEY);
    if (!raw) return { ...EMPTY_EXIT_ANSWERS };
    return {
      ...EMPTY_EXIT_ANSWERS,
      ...(JSON.parse(raw) as Partial<ExitAnswers>),
    };
  } catch {
    return { ...EMPTY_EXIT_ANSWERS };
  }
}

export function saveExitAnswers(answers: ExitAnswers) {
  try {
    localStorage.setItem(EXIT_ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // localStorage unavailable — 저장 없이 진행
  }
}
