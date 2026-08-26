import type { TaxProfile, TaxRuleCard } from './taxcheck';

export const RESULT_STORAGE_KEY = 'paycycle-results-v1';
const USER_STORAGE_KEY = 'paycycle-user-id';

export interface SavedTaxCheckResult {
  id: string;
  userId: string;
  kind: 'tax';
  createdAt: string;
  profileSignature: string;
  year: number;
  yearlyPay: number;
  monthsRecorded: number;
  needsActionCount: number;
  applicableCount: number;
  totalCount: number;
  taxProfile: TaxProfile;
  employment: null;
  ruleVersion: 'tax-v1';
}

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

/**
 * Lovable 원본과 같은 `paycycle-results-v1` 키를 사용합니다.
 * 이후 `/records`와 `/dashboard`는 kind === "tax"인 항목을 읽으면 됩니다.
 */
export function saveTaxCheckResult(
  input: NewTaxCheckResult,
): SavedTaxCheckResult | null {
  if (typeof window === 'undefined') return null;

  const record: SavedTaxCheckResult = {
    id: newId(),
    userId: currentUserId(),
    kind: 'tax',
    createdAt: new Date().toISOString(),
    profileSignature: '',
    year: input.year,
    yearlyPay: input.yearlyPay,
    monthsRecorded: input.monthsRecorded,
    needsActionCount: input.cards.filter(
      (card) => card.status === '추가 자료 필요',
    ).length,
    applicableCount: input.cards.filter(
      (card) => card.status === '적용 가능성 있음',
    ).length,
    totalCount: input.cards.length,
    taxProfile: { ...input.taxProfile },
    employment: null,
    ruleVersion: 'tax-v1',
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
