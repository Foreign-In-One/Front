export type TaxAnswer = boolean | null;

export interface TaxProfile {
  housingSaving: TaxAnswer;
  housingSavingProof: TaxAnswer;
  isHomeless: TaxAnswer;
  usesDeductions: TaxAnswer;
}

export type RuleStatus =
  | '적용 가능성 있음'
  | '조건 미충족'
  | '추가 자료 필요'
  | '현재 정보로 판단 불가';

export type RuleTone = 'possible' | 'need' | 'not' | 'unknown';

export interface EvidenceSource {
  title: string;
  url: string;
}

export interface TaxRuleCard {
  id: 'resident' | 'housing' | 'flat';
  title: string;
  status: RuleStatus;
  tone: RuleTone;
  summary: string;
  confirmed: string[];
  missing: string[];
  nextActions: string[];
  evidence: EvidenceSource[];
}

export interface TaxCheckInput {
  year: number;
  yearlyPay: number;
  monthsRecorded: number;
  entryDate: string | null;
  taxProfile: TaxProfile;
}

export const INITIAL_TAX_PROFILE: TaxProfile = {
  housingSaving: null,
  housingSavingProof: null,
  isHomeless: null,
  usesDeductions: null,
};

/**
 * 백엔드 연동 전 시연용 데이터입니다.
 * API가 준비되면 이 객체 대신 GET /api/dashboard 또는 사용자 급여 집계값을 넣으세요.
 */
export const TAXCHECK_DEMO_INPUT: Omit<TaxCheckInput, 'taxProfile'> = {
  year: 2026,
  yearlyPay: 6_150_000,
  monthsRecorded: 3,
  entryDate: null,
};

export const TAX_EVIDENCE = {
  resident: {
    title: '소득세법 제137조 — 근로소득세액의 연말정산',
    url: 'https://www.law.go.kr/법령/소득세법/제137조',
  },
  housing: {
    title: '조세특례제한법 제87조 — 주택청약종합저축 등에 대한 소득공제',
    url: 'https://www.law.go.kr/법령/조세특례제한법/제87조',
  },
  flat: {
    title: '조세특례제한법 제18조의2 — 외국인근로자에 대한 과세특례',
    url: 'https://www.law.go.kr/법령/조세특례제한법/제18조의2',
  },
} satisfies Record<string, EvidenceSource>;

const won = (amount: number) =>
  `${Math.round(amount).toLocaleString('ko-KR')}원`;

const answerLabel = (answer: TaxAnswer) => {
  if (answer === null) return '미응답';
  return answer ? '예' : '아니요';
};

export function statusTone(status: RuleStatus): RuleTone {
  switch (status) {
    case '적용 가능성 있음':
      return 'possible';
    case '추가 자료 필요':
      return 'need';
    case '조건 미충족':
      return 'not';
    default:
      return 'unknown';
  }
}

/** 올해 1월 1일 또는 입국일부터 오늘까지의 단순 체류일 수를 계산합니다. */
export function daysInKoreaThisYear(
  entryDate: string | null,
  year: number,
  today = new Date(),
): number | null {
  if (!entryDate) return null;

  const parts = entryDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [entryYear, entryMonth, entryDay] = parts as [number, number, number];
  const entry = new Date(entryYear, entryMonth - 1, entryDay);
  if (Number.isNaN(entry.getTime())) return null;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const until = today < yearEnd ? today : yearEnd;
  const from = entry > yearStart ? entry : yearStart;
  if (from > until) return 0;

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    Math.floor((until.getTime() - from.getTime()) / millisecondsPerDay) + 1,
    0,
  );
}

/**
 * TaxCheck의 화면 판정은 AI 추측이 아닌 입력값 기반의 단순 규칙입니다.
 * 법률상 최종 판정과 실제 유불리는 회사 담당자 또는 세무 전문가의 확인이 필요합니다.
 */
export function evaluateTax(input: TaxCheckInput): TaxRuleCard[] {
  const { year, yearlyPay, monthsRecorded, entryDate, taxProfile } = input;
  const days = daysInKoreaThisYear(entryDate, year);

  const residentStatus: RuleStatus =
    days === null
      ? '현재 정보로 판단 불가'
      : days >= 183
        ? '적용 가능성 있음'
        : '추가 자료 필요';

  const resident: TaxRuleCard = {
    id: 'resident',
    title: '거주자 여부',
    status: residentStatus,
    tone: statusTone(residentStatus),
    summary:
      days === null
        ? '입국일이 저장되지 않아 올해 국내 체류일을 계산할 수 없습니다.'
        : `현재 저장된 입국일을 기준으로 올해 국내 체류일은 약 ${days.toLocaleString('ko-KR')}일입니다.`,
    confirmed: [
      `대상 연도: ${year}년`,
      `입국일: ${entryDate ?? '입력되지 않음'}`,
      `국내 체류일: ${days === null ? '계산 불가' : `약 ${days.toLocaleString('ko-KR')}일`}`,
    ],
    missing:
      days === null
        ? ['입국일']
        : days >= 183
          ? []
          : ['국내 주소·가족·직업 등 생활관계 확인 자료'],
    nextActions:
      days === null
        ? ['입국일을 프로필에 입력한 뒤 거주자 구분을 다시 확인하세요.']
        : days < 183
          ? [
              '체류일 외의 생활관계 자료도 함께 확인하세요.',
              '회사 연말정산 담당자에게 거주자 구분을 문의하세요.',
            ]
          : ['회사 연말정산 담당자에게 최종 거주자 구분을 확인하세요.'],
    evidence: [TAX_EVIDENCE.resident],
  };

  const housingStatus: RuleStatus =
    taxProfile.housingSaving === null
      ? '현재 정보로 판단 불가'
      : taxProfile.housingSaving === false
        ? '조건 미충족'
        : taxProfile.isHomeless !== true ||
            taxProfile.housingSavingProof !== true
          ? '추가 자료 필요'
          : '적용 가능성 있음';

  const housing: TaxRuleCard = {
    id: 'housing',
    title: '주택청약저축 소득공제',
    status: housingStatus,
    tone: statusTone(housingStatus),
    summary:
      taxProfile.housingSaving === false
        ? '현재 입력값에서는 주택청약저축에 가입하지 않은 것으로 확인했습니다.'
        : '가입 여부와 무주택 여부, 납입증명서 보유 여부를 기준으로 준비 상태를 확인했습니다.',
    confirmed: [
      `주택청약저축 가입: ${answerLabel(taxProfile.housingSaving)}`,
      `무주택 여부: ${answerLabel(taxProfile.isHomeless)}`,
      `납입증명서 보유: ${answerLabel(taxProfile.housingSavingProof)}`,
      `확인된 급여: ${won(yearlyPay)} · ${monthsRecorded}개월`,
    ],
    missing: [
      ...(taxProfile.housingSaving === true &&
      taxProfile.housingSavingProof !== true
        ? ['주택청약저축 납입증명서']
        : []),
      ...(taxProfile.housingSaving === true && taxProfile.isHomeless !== true
        ? ['무주택 여부 확인']
        : []),
    ],
    nextActions:
      taxProfile.housingSaving === true
        ? [
            '금융기관 또는 홈택스에서 납입증명서를 준비하세요.',
            '공제 대상과 한도를 회사 담당자에게 확인하세요.',
          ]
        : ['실제 가입 상태와 입력값이 일치하는지 확인하세요.'],
    evidence: [TAX_EVIDENCE.housing],
  };

  const annualized = monthsRecorded > 0 ? (yearlyPay / monthsRecorded) * 12 : 0;
  const estimatedFlatTax = annualized * 0.19;
  const flatStatus: RuleStatus =
    monthsRecorded === 0
      ? '현재 정보로 판단 불가'
      : monthsRecorded < 3
        ? '추가 자료 필요'
        : taxProfile.usesDeductions === true
          ? '조건 미충족'
          : taxProfile.usesDeductions === null
            ? '현재 정보로 판단 불가'
            : '적용 가능성 있음';

  const flat: TaxRuleCard = {
    id: 'flat',
    title: '외국인 근로자 19% 단일세율',
    status: flatStatus,
    tone: statusTone(flatStatus),
    summary:
      monthsRecorded === 0
        ? '급여 기록이 없어 단일세율 비교에 필요한 연간 환산값을 만들 수 없습니다.'
        : `현재 ${monthsRecorded}개월 기록을 단순 연환산하면 ${won(annualized)}, 19% 적용 시 참고 세액은 약 ${won(estimatedFlatTax)}입니다.`,
    confirmed: [
      `급여 기록: ${monthsRecorded}개월 · ${won(yearlyPay)}`,
      `단순 연환산 급여: ${monthsRecorded > 0 ? won(annualized) : '계산 불가'}`,
      `다른 소득공제 사용: ${answerLabel(taxProfile.usesDeductions)}`,
    ],
    missing:
      monthsRecorded < 3 ? ['비교 정확도를 높이기 위한 추가 급여 기록'] : [],
    nextActions: [
      '일반세율과 단일세율을 각각 계산해 실제 부담세액을 비교하세요.',
      '적용 기간과 제외 요건을 회사 담당자 또는 세무 전문가에게 확인하세요.',
    ],
    evidence: [TAX_EVIDENCE.flat],
  };

  return [resident, housing, flat];
}

export function formatWon(amount: number) {
  return won(amount);
}
