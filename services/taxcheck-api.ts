import { isPaySummary, type PaySummary } from './records-api';

export interface TaxIncome {
  annualIncome: number | null;
  nonTaxableIncome: number | null;
  confirmed: boolean | null;
}

export interface TaxConditions {
  housingSaving: boolean | null;
  isHomeless: boolean | null;
  housingSavingProof: boolean | null;
  usesDeductions: boolean | null;
}

export interface TaxAnalyzeRequest {
  taxYear: number;
  taxDocumentId: null;
  income: TaxIncome;
  conditions: TaxConditions;
}

export type TaxSimulateRequest = Pick<
  TaxAnalyzeRequest,
  'income' | 'conditions'
>;

export interface TaxCard {
  id: string;
  title: string;
  status: string;
  tone: string;
  summary: string;
  confirmed: string[];
  missing: string[];
  nextActions: string[];
  evidence: { title: string; url: string }[];
}

/** Backend PR #7: saved snapshots and non-persistent simulations. */
export interface TaxResponse {
  taxCheckId: number | null;
  sourceTaxCheckId: number | null;
  simulation: boolean;
  taxYear: number;
  taxDocumentId: number | null;
  income: TaxIncome | null;
  conditions: TaxConditions | null;
  paySummary: PaySummary;
  analyzedAt: string;
  result: {
    annualIncome: number | null;
    flatTaxEstimate: number | null;
    generalTaxEstimate: null;
    taxDifference: null;
    residentStatus: string;
    elapsedDaysReference: number | null;
    status: string;
    cards: TaxCard[];
    requiredDocuments: string[];
    analysisSummary: string;
    nextAction: string;
    calculation: {
      mode: 'FLAT_19_ASSUMPTION';
      ruleVersion: string;
      rate: number;
      incomeBase: number | null;
      eligibilityConfirmed: false;
      missingFields: string[];
      warnings: string[];
    };
  };
}

export class TaxApiError extends Error {
  constructor(
    public readonly kind: 'input' | 'http' | 'response' | 'network' | 'timeout',
    public readonly status?: number,
    public readonly saveUncertain = false,
  ) {
    super(`TaxCheck request failed: ${kind}`);
    this.name = 'TaxApiError';
  }
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
const MAX_AMOUNT = 9999999999999.99;
const CONDITION_KEYS = [
  'housingSaving',
  'isHomeless',
  'housingSavingProof',
  'usesDeductions',
] as const;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}
function amount(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= MAX_AMOUNT)
  );
}
function answer(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}
function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function year(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 2000 &&
    value <= 2100
  );
}
function income(value: unknown): value is TaxIncome {
  return (
    object(value) &&
    amount(value.annualIncome) &&
    amount(value.nonTaxableIncome) &&
    answer(value.confirmed)
  );
}
function conditions(value: unknown): value is TaxConditions {
  return object(value) && CONDITION_KEYS.every((key) => answer(value[key]));
}
function httpUrl(value: unknown): value is string {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function card(value: unknown): value is TaxCard {
  return (
    object(value) &&
    text(value.id) &&
    text(value.title) &&
    text(value.status) &&
    text(value.tone) &&
    text(value.summary) &&
    strings(value.confirmed) &&
    strings(value.missing) &&
    strings(value.nextActions) &&
    Array.isArray(value.evidence) &&
    value.evidence.every(
      (source) => object(source) && text(source.title) && httpUrl(source.url),
    )
  );
}

function response(value: unknown): value is TaxResponse {
  if (
    !object(value) ||
    !year(value.taxYear) ||
    typeof value.simulation !== 'boolean' ||
    !(value.simulation
      ? value.taxCheckId === null && id(value.sourceTaxCheckId)
      : id(value.taxCheckId) && value.sourceTaxCheckId === null) ||
    !(value.taxDocumentId === null || id(value.taxDocumentId)) ||
    !(value.income === null || income(value.income)) ||
    !(value.conditions === null || conditions(value.conditions)) ||
    !isPaySummary(value.paySummary, value.taxYear) ||
    !text(value.analyzedAt) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value.analyzedAt) ||
    !object(value.result)
  )
    return false;
  const result = value.result;
  if (
    !amount(result.annualIncome) ||
    !amount(result.flatTaxEstimate) ||
    result.generalTaxEstimate !== null ||
    result.taxDifference !== null ||
    !text(result.status) ||
    !text(result.residentStatus) ||
    !(
      result.elapsedDaysReference === null ||
      (typeof result.elapsedDaysReference === 'number' &&
        Number.isSafeInteger(result.elapsedDaysReference) &&
        result.elapsedDaysReference >= 0)
    ) ||
    !Array.isArray(result.cards) ||
    !result.cards.every(card) ||
    new Set(result.cards.map((item) => item.id)).size !== result.cards.length ||
    !strings(result.requiredDocuments) ||
    !text(result.analysisSummary) ||
    !text(result.nextAction) ||
    !object(result.calculation)
  )
    return false;
  const calculation = result.calculation;
  return (
    calculation.mode === 'FLAT_19_ASSUMPTION' &&
    text(calculation.ruleVersion) &&
    calculation.rate === 0.19 &&
    calculation.eligibilityConfirmed === false &&
    amount(calculation.incomeBase) &&
    strings(calculation.missingFields) &&
    strings(calculation.warnings) &&
    (result.flatTaxEstimate === null) === (calculation.incomeBase === null)
  );
}

/** No retries, local fallback, API-key use or financial calculations. */
async function request(
  path: string,
  body: TaxAnalyzeRequest | TaxSimulateRequest | undefined,
  signal: AbortSignal | undefined,
  saves: boolean,
  accept: (value: TaxResponse) => boolean,
): Promise<TaxResponse> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  let sent = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    controller.signal.throwIfAborted();
    sent = true;
    const http = await fetch(BASE_URL.replace(/\/+$/, '') + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!http.ok)
      throw new TaxApiError('http', http.status, saves && http.status >= 500);
    let envelope: unknown;
    try {
      envelope = await http.json();
    } catch {
      throw new TaxApiError('response', undefined, saves);
    }
    if (
      !object(envelope) ||
      envelope.success !== true ||
      !response(envelope.data) ||
      !accept(envelope.data)
    ) {
      throw new TaxApiError('response', undefined, saves);
    }
    return envelope.data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new TaxApiError('timeout', undefined, saves && sent);
    if (error instanceof TaxApiError) throw error;
    throw new TaxApiError('network', undefined, saves && sent);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function getTaxCheckApi(taxCheckId: number, signal?: AbortSignal) {
  if (!id(taxCheckId)) return Promise.reject(new TaxApiError('input'));
  return request(
    `/api/tax-checks/${taxCheckId}?userId=1`,
    undefined,
    signal,
    false,
    (data) => !data.simulation && data.taxCheckId === taxCheckId,
  );
}

export function analyzeTaxCheckApi(
  input: TaxAnalyzeRequest,
  signal?: AbortSignal,
) {
  if (
    !year(input.taxYear) ||
    input.taxDocumentId !== null ||
    !income(input.income) ||
    !conditions(input.conditions)
  ) {
    return Promise.reject(new TaxApiError('input'));
  }
  return request(
    '/api/tax-checks/analyze?userId=1',
    input,
    signal,
    true,
    (data) => !data.simulation && data.taxYear === input.taxYear,
  );
}

export function simulateTaxCheckApi(
  source: TaxResponse,
  input: TaxSimulateRequest,
  signal?: AbortSignal,
) {
  if (
    source.simulation ||
    !id(source.taxCheckId) ||
    !income(input.income) ||
    !conditions(input.conditions)
  ) {
    return Promise.reject(new TaxApiError('input'));
  }
  return request(
    `/api/tax-checks/${source.taxCheckId}/simulate?userId=1`,
    input,
    signal,
    false,
    (data) =>
      data.simulation &&
      data.sourceTaxCheckId === source.taxCheckId &&
      data.taxYear === source.taxYear,
  );
}
