import type { TaxProfile, TaxRuleCard } from './taxcheck';
import type { ExitClaim } from './types';

export const RESULT_STORAGE_KEY = 'paycycle-results-v1';
const USER_STORAGE_KEY = 'paycycle-user-id';

export type ResultKind = 'pay' | 'tax' | 'exit';

interface SavedResultBase {
  id: string;
  userId: string;
  createdAt: string;
  profileSignature: string;
}

export interface SavedPayCheckResult extends SavedResultBase {
  kind: 'pay';
  payPeriod: string;
  workplace: string;
  status?: string;
  differenceAmount: number | null;
  paidAmount: number | null;
  findingCount?: number;
}

export interface SavedTaxCheckResult extends SavedResultBase {
  kind: 'tax';
  year: number;
  yearlyPay: number;
  monthsRecorded: number;
  needsActionCount: number;
  unknownCount?: number;
  applicableCount: number;
  totalCount: number;
  taxProfile: TaxProfile;
  employment: null;
  ruleVersion: 'tax-v1';
  /** 이전 저장 기록에는 없을 수 있어 선택값으로 둡니다. */
  cards?: TaxRuleCard[];
}

export interface SavedExitCheckResult extends SavedResultBase {
  kind: 'exit';
  departureDate: string | null;
  readyCount: number;
  totalCount: number;
  /** 이전 저장 기록에는 없을 수 있어 선택값으로 둡니다. */
  claims?: ExitClaim[];
}

export type SavedResult =
  | SavedPayCheckResult
  | SavedTaxCheckResult
  | SavedExitCheckResult;

export interface NewTaxCheckResult {
  year: number;
  yearlyPay: number;
  monthsRecorded: number;
  taxProfile: TaxProfile;
  cards: TaxRuleCard[];
}

function currentUserId() {
  if (typeof window === 'undefined') return 'local-user';

  try {
    const saved = window.localStorage.getItem(USER_STORAGE_KEY);
    if (saved) return saved;

    const created = `u_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(USER_STORAGE_KEY, created);
    return created;
  } catch {
    return 'local-user';
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tax_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readStoredResults(): unknown[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RESULT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isTaxRuleCard(value: unknown): value is TaxRuleCard {
  if (!value || typeof value !== 'object') return false;

  const card = value as Record<string, unknown>;

  return (
    ['resident', 'housing', 'flat'].includes(String(card.id)) &&
    typeof card.title === 'string' &&
    [
      '적용 가능성 있음',
      '조건 미충족',
      '추가 자료 필요',
      '현재 정보로 판단 불가',
    ].includes(String(card.status)) &&
    ['possible', 'need', 'not', 'unknown'].includes(String(card.tone)) &&
    typeof card.summary === 'string' &&
    isStringArray(card.confirmed) &&
    isStringArray(card.missing) &&
    isStringArray(card.nextActions) &&
    Array.isArray(card.evidence) &&
    card.evidence.every((value) => {
      if (!value || typeof value !== 'object') return false;

      const evidence = value as Record<string, unknown>;
      return (
        typeof evidence.title === 'string' && typeof evidence.url === 'string'
      );
    })
  );
}

function isSavedResult(value: unknown): value is SavedResult {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  const hasBaseFields =
    typeof candidate.id === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.createdAt === 'string';

  if (!hasBaseFields) return false;

  if (candidate.kind === 'tax') {
    return (
      candidate.cards === undefined ||
      (Array.isArray(candidate.cards) && candidate.cards.every(isTaxRuleCard))
    );
  }

  return candidate.kind === 'pay' || candidate.kind === 'exit';
}

function writeStoredResults(records: SavedResult[]) {
  window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(records));
}

/** 현재 브라우저 사용자의 저장 결과를 최신순으로 반환합니다. */
export function listSavedResults(): SavedResult[] {
  if (typeof window === 'undefined') return [];

  const userId = currentUserId();
  return readStoredResults()
    .filter(isSavedResult)
    .filter((record) => record.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 현재 브라우저 사용자의 결과 한 건을 삭제합니다. */
export function removeSavedResult(id: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const userId = currentUserId();
    const records = readStoredResults().filter(isSavedResult);
    writeStoredResults(
      records.filter(
        (record) => !(record.id === id && record.userId === userId),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export interface NewExitCheckResult {
  profileSignature?: string;
  departureDate: string | null;
  readyCount: number;
  totalCount: number;
  claims: ExitClaim[];
}

export interface NewPayCheckResult {
  profileSignature?: string;
  payPeriod: string;
  workplace: string;
  status?: string;
  differenceAmount: number | null;
  paidAmount: number | null;
  findingCount?: number;
}

/**
 * Lovable 원본과 같은 `paycycle-results-v1` 키를 사용합니다.
 * 이후 `/records`와 `/dashboard`는 kind === "tax"인 항목을 읽으면 됩니다.
 */
export function saveTaxCheckResult(
  input: NewTaxCheckResult & { profileSignature?: string },
): SavedTaxCheckResult | null {
  if (typeof window === 'undefined') return null;

  const record: SavedTaxCheckResult = {
    id: newId(),
    userId: currentUserId(),
    kind: 'tax',
    createdAt: new Date().toISOString(),
    profileSignature: input.profileSignature ?? '',
    year: input.year,
    yearlyPay: input.yearlyPay,
    monthsRecorded: input.monthsRecorded,
    needsActionCount: input.cards.filter(
      (card) => card.status === '추가 자료 필요',
    ).length,
    unknownCount: input.cards.filter(
      (card) => card.status === '현재 정보로 판단 불가',
    ).length,
    applicableCount: input.cards.filter(
      (card) => card.status === '적용 가능성 있음',
    ).length,
    totalCount: input.cards.length,
    taxProfile: { ...input.taxProfile },
    employment: null,
    ruleVersion: 'tax-v1',
    cards: input.cards.map((card) => ({
      ...card,
      confirmed: [...card.confirmed],
      missing: [...card.missing],
      nextActions: [...card.nextActions],
      evidence: card.evidence.map((evidence) => ({ ...evidence })),
    })),
  };

  try {
    const records = readStoredResults();
    window.localStorage.setItem(
      RESULT_STORAGE_KEY,
      JSON.stringify([record, ...records]),
    );
    return record;
  } catch {
    return null;
  }
}

/** 출국 정산 결과 저장 */
export function saveExitCheckResult(
  input: NewExitCheckResult,
): SavedExitCheckResult | null {
  if (typeof window === 'undefined') return null;

  const record: SavedExitCheckResult = {
    id: `exit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: currentUserId(),
    kind: 'exit',
    createdAt: new Date().toISOString(),
    profileSignature: input.profileSignature ?? '',
    departureDate: input.departureDate,
    readyCount: input.readyCount,
    totalCount: input.totalCount,
    claims: input.claims.map((claim) => ({
      ...claim,
      confirmed: [...claim.confirmed],
      missing: [...claim.missing],
      documents: [...claim.documents],
      evidence: claim.evidence.map((evidence) => ({ ...evidence })),
    })),
  };

  try {
    const records = readStoredResults();
    window.localStorage.setItem(
      RESULT_STORAGE_KEY,
      JSON.stringify([record, ...records]),
    );
    return record;
  } catch {
    return null;
  }
}

/** 급여 확인 결과 저장 */
export function savePayCheckResult(
  input: NewPayCheckResult,
): SavedPayCheckResult | null {
  if (typeof window === 'undefined') return null;

  const record: SavedPayCheckResult = {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: currentUserId(),
    kind: 'pay',
    createdAt: new Date().toISOString(),
    profileSignature: input.profileSignature ?? '',
    payPeriod: input.payPeriod,
    workplace: input.workplace,
    status: input.status,
    differenceAmount: input.differenceAmount,
    paidAmount: input.paidAmount,
    findingCount: input.findingCount,
  };

  try {
    const records = readStoredResults();
    window.localStorage.setItem(
      RESULT_STORAGE_KEY,
      JSON.stringify([record, ...records]),
    );
    return record;
  } catch {
    return null;
  }
}
