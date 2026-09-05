import type {
  TaxAnalyzeRequest,
  TaxConditions,
  TaxResponse,
} from '@/services/taxcheck-api';

export interface TaxForm {
  taxYear: string;
  annualIncome: string;
  nonTaxableIncome: string;
  confirmed: boolean;
  conditions: TaxConditions;
}

export type TaxInputError =
  | 'year'
  | 'annualIncome'
  | 'nonTaxableIncome'
  | 'total';

export function koreaYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      timeZone: 'Asia/Seoul',
    }).format(now),
  );
}

export function emptyTaxForm(now = new Date()): TaxForm {
  return {
    taxYear: String(koreaYear(now) - 1),
    annualIncome: '',
    nonTaxableIncome: '',
    confirmed: false,
    conditions: {
      housingSaving: null,
      isHomeless: null,
      housingSavingProof: null,
      usesDeductions: null,
    },
  };
}

/** Empty is null, never zero. Validate decimal text without binary-float arithmetic. */
function cents(value: string): bigint | null | undefined {
  const normalized = value.trim();
  if (normalized === '') return null;
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ''] = normalized.split('.');
  const result = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  return result <= BigInt('999999999999999') ? result : undefined;
}

export function validateTaxForm(
  form: TaxForm,
  now = new Date(),
): TaxInputError | null {
  const year = Number(form.taxYear);
  if (
    !/^\d{4}$/.test(form.taxYear) ||
    year < 2000 ||
    year > Math.min(2100, koreaYear(now))
  )
    return 'year';
  const annual = cents(form.annualIncome);
  const nonTaxable = cents(form.nonTaxableIncome);
  if (annual === undefined) return 'annualIncome';
  if (nonTaxable === undefined) return 'nonTaxableIncome';
  // The confirmed-input bound does not depend on supported calculation years.
  if (
    form.confirmed &&
    annual !== null &&
    nonTaxable !== null &&
    annual + nonTaxable > BigInt('999999999999999')
  )
    return 'total';
  return null;
}

export function shouldWarnNonTaxableIncome(form: TaxForm): boolean {
  const annual = cents(form.annualIncome);
  const nonTaxable = cents(form.nonTaxableIncome);
  return (
    form.confirmed &&
    annual !== null &&
    annual !== undefined &&
    nonTaxable !== null &&
    nonTaxable !== undefined &&
    nonTaxable > annual
  );
}

export function taxRequest(form: TaxForm, now = new Date()): TaxAnalyzeRequest {
  const error = validateTaxForm(form, now);
  if (error) throw new Error(error);
  return {
    taxYear: Number(form.taxYear),
    taxDocumentId: null,
    income: {
      annualIncome:
        form.annualIncome.trim() === '' ? null : Number(form.annualIncome),
      nonTaxableIncome:
        form.nonTaxableIncome.trim() === ''
          ? null
          : Number(form.nonTaxableIncome),
      confirmed: form.confirmed,
    },
    conditions: { ...form.conditions },
  };
}

export function formFromTax(source: TaxResponse): TaxForm {
  return {
    taxYear: String(source.taxYear),
    annualIncome:
      source.income?.annualIncome == null
        ? ''
        : String(source.income.annualIncome),
    nonTaxableIncome:
      source.income?.nonTaxableIncome == null
        ? ''
        : String(source.income.nonTaxableIncome),
    confirmed: source.income?.confirmed === true,
    conditions: { ...emptyTaxForm().conditions, ...source.conditions },
  };
}

export function taxMoney(
  value: number | null,
  locale: string,
  unavailable: string,
): string {
  return value === null
    ? unavailable
    : new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 2,
      }).format(value);
}

/** An explicit ID loads a saved result; no auto-analysis on mount or refresh. */
export function taxIdFromUrl(url: string): number | null {
  const values = new URL(url).searchParams.getAll('taxCheckId');
  if (values.length === 0) return null;
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0]))
    throw new Error('invalid taxCheckId');
  const value = Number(values[0]);
  if (!Number.isSafeInteger(value)) throw new Error('invalid taxCheckId');
  return value;
}
