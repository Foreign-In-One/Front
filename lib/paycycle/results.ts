import type {
  EmploymentProfile,
  ExitProfile,
  PayCheckStatus,
  PayDocuments,
  TaxProfile,
  UserProfile,
} from "./types";

/**
 * 저장되는 분석 결과.
 * 화면 문장이 아니라 "입력 스냅샷 + 판정값"만 저장한다.
 * 상세 화면은 저장된 스냅샷을 룰 엔진에 다시 넣어 현재 언어로 렌더링하므로
 * 언어를 바꿔도 저장된 결과가 그대로 유지된다.
 */

export type ResultKind = "pay" | "tax" | "exit";

interface ResultBase {
  id: string;
  userId: string;
  kind: ResultKind;
  /** ISO 8601 */
  createdAt: string;
  /** 프로필 변경 감지용 서명 */
  profileSignature: string;
}

export interface PayCheckResult extends ResultBase {
  kind: "pay";
  payPeriod: string; // YYYY-MM
  workplace: string;
  status: PayCheckStatus;
  differenceAmount: number | null;
  paidAmount: number | null;
  findingCount: number;
  documents: PayDocuments;
  employment: EmploymentProfile | null;
}

export interface TaxCheckResult extends ResultBase {
  kind: "tax";
  year: number;
  yearlyPay: number;
  monthsRecorded: number;
  /** 추가 자료가 필요한 항목 수 */
  needsActionCount: number;
  applicableCount: number;
  totalCount: number;
  taxProfile: TaxProfile;
  employment: EmploymentProfile | null;
}

export interface ExitCheckResult extends ResultBase {
  kind: "exit";
  departureDate: string | null;
  /** 준비도: done / total */
  readyCount: number;
  totalCount: number;
  exitProfile: ExitProfile;
  employment: EmploymentProfile | null;
}

export type SavedResult = PayCheckResult | TaxCheckResult | ExitCheckResult;

/** 프로필이 바뀌면 저장된 결과를 다시 확인해야 한다. */
export function profileSignature(
  profile: UserProfile | null,
  employment: EmploymentProfile | null,
): string {
  return [
    profile?.nationality ?? "",
    profile?.visa ?? "",
    employment?.status ?? "",
    employment?.entryDate?.value ?? "",
    employment?.workStartDate?.value ?? "",
    employment?.exitDate?.value ?? "",
    employment?.payDay ?? "",
    employment?.workplace ?? "",
  ].join("|");
}

/** 유니온 각 멤버에 개별 적용되는 Omit. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** 저장 전 입력값(자동 부여 필드 제외). */
export type NewResult = DistributiveOmit<
  SavedResult,
  "id" | "userId" | "createdAt" | "profileSignature"
>;
