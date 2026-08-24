export type LanguageCode = "vi" | "km" | "th" | "id" | "ne" | "tl" | "en";

/** 근로 상태 — 온보딩 첫 질문이며 이후 화면 구성을 분기한다. */
export type EmploymentStatus = "PRE_EMPLOYMENT" | "EMPLOYED" | "SEPARATED" | "CHANGING";

/** 날짜는 "모름/미정"을 값으로 표현할 수 있어야 한다. */
export interface DateValue {
  /** YYYY-MM-DD, 미정이면 빈 문자열 */
  value: string;
  unknown: boolean;
}

export const EMPTY_DATE: DateValue = { value: "", unknown: false };

export interface UserProfile {
  nickname: string;
  nationality: string;
  visa: string;
  /** 서비스 전체 언어. 질문카드는 한국어와 이 언어를 병기한다. */
  language: LanguageCode;
}

export interface EmploymentProfile {
  status: EmploymentStatus;
  entryDate: DateValue;
  workStartDate: DateValue;
  currentWorkplaceStartDate: DateValue;
  exitDate: DateValue;
  /** 계약상 급여일(1~31), 모르면 null */
  payDay: number | null;
  workplace: string;
  previousWorkplace: string;
}

/* --------------------------------- PayCheck -------------------------------- */

export type DocKind = "contract" | "statement" | "deposit";

export interface DocFields {
  basePay: number | null;
  allowances: number | null;
  deductions: number | null;
  netPay: number | null;
  /** 계약상 급여일(계약서) */
  payDay: number | null;
  /** 실제 지급/입금일 (YYYY-MM-DD) */
  payDate: string | null;
  period: string; // YYYY-MM
}

export function emptyFields(period: string): DocFields {
  return {
    basePay: null,
    allowances: null,
    deductions: null,
    netPay: null,
    payDay: null,
    payDate: null,
    period,
  };
}

export interface PayDocument {
  kind: DocKind;
  source: "upload" | "manual" | "sample";
  fileName: string;
  fields: DocFields;
  /** 사용자가 추출값을 확인했는지 */
  confirmed: boolean;
  /** 개인정보 마스킹 처리 여부 */
  masked: boolean;
  /** 추출 방식 설명 (AI 추출 / 직접 입력 / 판독 실패) */
  note: string;
}

export type PayDocuments = Partial<Record<DocKind, PayDocument>>;

export type PayCheckStatus =
  | "MATCH"
  | "EXPLANATION_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "USER_CONFIRMATION";

export interface EvidenceSource {
  title: string;
  url: string;
}

export interface ComparisonRow {
  item: string;
  contract: string;
  statement: string;
  deposit: string;
  result: string;
  status: PayCheckStatus;
}

export interface PayFinding {
  id: string;
  status: PayCheckStatus;
  title: string;
  /** 확인된 사실 */
  fact: string;
  /** 공식 기준 */
  standard: string;
  /** 판단 범위 */
  limitation: string;
  /** 다음 행동 */
  nextActions: string[];
  comparison: string;
  left: { label: string; amount: number | null };
  right: { label: string; amount: number | null };
  difference: number;
  requiredEvidence: string[];
  sources: string[];
  evidence: EvidenceSource[];
}

export interface PaycheckAnalysis {
  rows: ComparisonRow[];
  findings: PayFinding[];
  overallStatus: PayCheckStatus;
  headline: string;
  detail: string;
  /** 실제 실행된 처리 단계 결과 */
  steps: { label: string; ok: boolean; detail: string }[];
}

export interface PayRecord {
  id: string;
  period: string; // YYYY-MM
  workplace: string;
  checkedAt: string; // YYYY-MM-DD
  /** 확인된 실제 입금액. 확인 불가면 null */
  paidAmount: number | null;
  documents: PayDocuments;
  analysis: PaycheckAnalysis;
}

/* ------------------------------ 금융권리 캘린더 ------------------------------ */

export type EventCategory = "급여" | "세금" | "보험" | "연금" | "출국" | "프로필" | "기타";
export type EventSource = "paycheck" | "taxcheck" | "exitcheck" | "profile" | "manual";

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  category: EventCategory;
  source: EventSource;
  title: string;
  detail?: string;
  amount?: number;
  auto?: boolean;
  /** 공식 기한인지, 서비스가 권장하는 준비일인지 */
  kind: "확정" | "권장";
}

/* --------------------------------- TaxCheck -------------------------------- */

export type RuleStatus = "적용 가능성 있음" | "조건 미충족" | "추가 자료 필요" | "현재 정보로 판단 불가";

export interface TaxProfile {
  housingSaving: boolean | null;
  housingSavingProof: boolean | null;
  isHomeless: boolean | null;
  usesDeductions: boolean | null;
}

export interface TaxCard {
  id: string;
  title: string;
  status: RuleStatus;
  summary: string;
  confirmed: string[];
  missing: string[];
  nextActions: string[];
  evidence: EvidenceSource[];
}

/* -------------------------------- ExitCheck -------------------------------- */

export interface ExitProfile {
  hasInsuranceRecord: boolean | null;
  pensionDeducted: boolean | null;
  hasExitProof: boolean | null;
  hasRecentPayslip: boolean | null;
  hasOwnAccount: boolean | null;
}

export interface ExitClaim {
  id: string;
  title: string;
  status: RuleStatus | "대상 후보";
  confirmed: string[];
  missing: string[];
  documents: string[];
  nextAction: string;
  evidence: EvidenceSource[];
}

/* ---------------------------------- 상태 ---------------------------------- */

export interface PayCycleState {
  profile: UserProfile | null;
  employment: EmploymentProfile | null;
  payRecords: PayRecord[];
  events: CalendarEvent[];
  taxProfile: TaxProfile;
  exitProfile: ExitProfile;
  sampleMode: boolean;
}
