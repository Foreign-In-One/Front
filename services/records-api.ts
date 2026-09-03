/** Backend #9/#7 read contracts. Never substitute local or sample records. */
export type RecordType = 'PAYCHECK' | 'TAX_CHECK' | 'EXIT_CHECK';
export type RecordsFilter = RecordType | 'ALL';

export interface RecordSummary {
  recordKey: string;
  type: RecordType;
  sourceId: number;
  recordedAt: string | null;
  analyzedAt: string | null;
  status: string | null;
  analysisSummary: string | null;
  nextAction: string | null;
  payPeriod: string | null;
  taxYear: number | null;
  expectedExitDate: string | null;
  actualAmount: number | null;
  readinessScore: number | null;
}

export interface RecordCounts {
  all: number;
  paycheck: number;
  taxCheck: number;
  exitCheck: number;
}

export interface RecordsResponse {
  items: RecordSummary[];
  counts: RecordCounts;
}

/** Only the stored card fields rendered by Records, not a new analysis. */
export interface StoredTaxCard {
  id: string;
  title: string;
  status: string;
  summary: string;
  nextActions: string[];
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
const COUNT_KEY: Record<RecordType, keyof RecordCounts> = {
  PAYCHECK: 'paycheck',
  TAX_CHECK: 'taxCheck',
  EXIT_CHECK: 'exitCheck',
};

export class RecordsApiError extends Error {
  constructor(
    public readonly kind: 'network' | 'http' | 'response' | 'timeout',
    public readonly status?: number,
  ) {
    super(`Could not read backend records: ${kind}`);
    this.name = 'RecordsApiError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRecordType(value: unknown): value is RecordType {
  return (
    value === 'PAYCHECK' || value === 'TAX_CHECK' || value === 'EXIT_CHECK'
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveId(value: unknown): value is number {
  return isCount(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableAmount(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0)
  );
}

function isRecordSummary(value: unknown): value is RecordSummary {
  return (
    isObject(value) &&
    isRecordType(value.type) &&
    isPositiveId(value.sourceId) &&
    value.recordKey === `${value.type}:${value.sourceId}` &&
    isNullableString(value.recordedAt) &&
    isNullableString(value.analyzedAt) &&
    isNullableString(value.status) &&
    isNullableString(value.analysisSummary) &&
    isNullableString(value.nextAction) &&
    isNullableString(value.payPeriod) &&
    (value.taxYear === null || isCount(value.taxYear)) &&
    isNullableString(value.expectedExitDate) &&
    isNullableAmount(value.actualAmount) &&
    (value.readinessScore === null || isCount(value.readinessScore))
  );
}

function isRecordCounts(value: unknown): value is RecordCounts {
  return (
    isObject(value) &&
    isCount(value.all) &&
    isCount(value.paycheck) &&
    isCount(value.taxCheck) &&
    isCount(value.exitCheck) &&
    value.all === value.paycheck + value.taxCheck + value.exitCheck
  );
}

async function readData(path: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(BASE_URL.replace(/\/+$/, '') + path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) throw new RecordsApiError('http', response.status);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new RecordsApiError('response');
    }
    if (!isObject(body) || body.success !== true || !('data' in body)) {
      throw new RecordsApiError('response');
    }
    return body.data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new RecordsApiError('timeout');
    if (error instanceof RecordsApiError) throw error;
    throw new RecordsApiError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function getRecordsApi(
  filter: RecordsFilter = 'ALL',
  signal?: AbortSignal,
): Promise<RecordsResponse> {
  if (filter !== 'ALL' && !isRecordType(filter)) {
    throw new RecordsApiError('response');
  }
  // This is the existing shared demo identity, not authentication.
  const query = filter === 'ALL' ? '' : `&type=${filter}`;
  const data = await readData(`/api/records?userId=1${query}`, signal);
  if (
    !isObject(data) ||
    !Array.isArray(data.items) ||
    !data.items.every(isRecordSummary) ||
    !isRecordCounts(data.counts)
  ) {
    throw new RecordsApiError('response');
  }
  const { items, counts } = data;
  const keys = new Set(items.map((item) => item.recordKey));
  const expectedCount =
    filter === 'ALL' ? counts.all : counts[COUNT_KEY[filter]];
  if (
    keys.size !== items.length ||
    items.length !== expectedCount ||
    (filter !== 'ALL' && items.some((item) => item.type !== filter)) ||
    (filter === 'ALL' &&
      Object.entries(COUNT_KEY).some(
        ([type, key]) =>
          items.filter((item) => item.type === type).length !== counts[key],
      ))
  ) {
    throw new RecordsApiError('response');
  }
  // Keep server order and null amounts; do not sort, sum, or fill missing values.
  return { items, counts };
}

export async function getStoredTaxCardsApi(
  taxCheckId: number,
  signal?: AbortSignal,
): Promise<StoredTaxCard[]> {
  if (!isPositiveId(taxCheckId)) throw new RecordsApiError('response');
  const data = await readData(`/api/tax-checks/${taxCheckId}?userId=1`, signal);
  if (
    !isObject(data) ||
    data.taxCheckId !== taxCheckId ||
    data.simulation !== false ||
    !isObject(data.result) ||
    !Array.isArray(data.result.cards)
  ) {
    throw new RecordsApiError('response');
  }
  const cards: StoredTaxCard[] = [];
  for (const card of data.result.cards) {
    if (
      !isObject(card) ||
      typeof card.id !== 'string' ||
      typeof card.title !== 'string' ||
      typeof card.status !== 'string' ||
      typeof card.summary !== 'string' ||
      !Array.isArray(card.nextActions) ||
      !card.nextActions.every((action: unknown) => typeof action === 'string')
    ) {
      throw new RecordsApiError('response');
    }
    cards.push({
      id: card.id,
      title: card.title,
      status: card.status,
      summary: card.summary,
      nextActions: card.nextActions,
    });
  }
  if (new Set(cards.map((card) => card.id)).size !== cards.length) {
    throw new RecordsApiError('response');
  }
  return cards;
}
