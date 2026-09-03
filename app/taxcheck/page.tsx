'use client';

import { ArrowLeft, ArrowRight, Receipt, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import {
  analyzeTaxCheckApi,
  getTaxCheckApi,
  simulateTaxCheckApi,
  TaxApiError,
  type TaxConditions,
  type TaxResponse,
} from '@/services/taxcheck-api';
import { TAX_COPY, type TaxCopy } from './taxcheck-copy';
import {
  emptyTaxForm,
  formFromTax,
  koreaYear,
  type TaxForm,
  type TaxInputError,
  taxIdFromUrl,
  taxMoney,
  taxRequest,
  validateTaxForm,
} from './taxcheck-form';
import { TaxResultView } from './taxcheck-result';

type PageError = TaxInputError | 'read' | 'write' | 'uncertain' | 'url';
type Pending = 'read' | 'analyze' | 'simulate' | null;
const inputClass =
  'mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground';

function setSavedUrl(id: number | null) {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete('taxCheckId');
  else url.searchParams.set('taxCheckId', String(id));
  window.history.replaceState(window.history.state, '', url);
}

function Question({
  name,
  label,
  value,
  onChange,
  copy,
}: {
  name: string;
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  copy: TaxCopy;
}) {
  return (
    <label className="block font-medium text-sm" htmlFor={name}>
      {label}
      <select
        id={name}
        className={inputClass}
        value={value === null ? '' : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : event.target.value === 'true',
          )
        }
      >
        <option value="">{copy.unknown}</option>
        <option value="true">{copy.yes}</option>
        <option value="false">{copy.no}</option>
      </select>
    </label>
  );
}

export default function TaxCheckPage() {
  const { locale, t } = useT();
  const copy = TAX_COPY[locale];
  const [step, setStep] = useState(-1);
  const [form, setForm] = useState<TaxForm>(() => emptyTaxForm());
  const [original, setOriginal] = useState<TaxResponse | null>(null);
  const [scenario, setScenario] = useState<TaxResponse | null>(null);
  const [mode, setMode] = useState<'analyze' | 'simulate'>('analyze');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<PageError | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loadId, setLoadId] = useState<number | null>(null);
  // Synchronous lock: React state alone does not prevent two clicks in one tick.
  const activeRequest = useRef<AbortController | null>(null);
  const busy = pending !== null;
  const uncertain = error === 'uncertain' && !acknowledged;
  const displayed = scenario ?? original;

  const loadSaved = useCallback(async (id: number) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoadId(id);
    setPending('read');
    setError(null);
    try {
      const data = await getTaxCheckApi(id, controller.signal);
      if (activeRequest.current !== controller) return;
      setOriginal(data);
      setScenario(null);
      setForm(formFromTax(data));
      setMode('analyze');
      setStep(3);
    } catch {
      if (activeRequest.current === controller) setError('read');
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(null);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const id = taxIdFromUrl(window.location.href);
      if (id !== null) void loadSaved(id);
    } catch {
      setError('url');
    }
    return () => {
      const request = activeRequest.current;
      activeRequest.current = null;
      request?.abort(); // Abort waiting only; it cannot undo a server-side save.
    };
  }, [loadSaved]);

  const changeIncome = (
    patch: Partial<
      Pick<TaxForm, 'taxYear' | 'annualIncome' | 'nonTaxableIncome'>
    >,
  ) => {
    setForm((previous) => ({ ...previous, ...patch, confirmed: false }));
    if (error !== 'uncertain') setError(null);
  };
  const changeCondition = (key: keyof TaxConditions, value: boolean | null) => {
    setForm((previous) => ({
      ...previous,
      conditions: {
        ...previous.conditions,
        [key]: value,
        ...(key === 'housingSaving' && value !== true
          ? { housingSavingProof: null }
          : {}),
      },
    }));
  };
  const startNew = () => {
    if (activeRequest.current || uncertain) return;
    setSavedUrl(null);
    setForm(emptyTaxForm());
    setOriginal(null);
    setScenario(null);
    setMode('analyze');
    setError(null);
    setAcknowledged(false);
    setLoadId(null);
    setStep(0);
  };
  const startSimulation = () => {
    if (!original || activeRequest.current) return;
    setForm({ ...formFromTax(original), confirmed: false });
    setScenario(null);
    setMode('simulate');
    setError(null);
    setAcknowledged(false);
    setStep(0);
  };
  const restoreOriginal = () => {
    if (!original || activeRequest.current) return;
    setForm(formFromTax(original));
    setScenario(null);
    setMode('analyze');
    setError(null);
    setStep(3);
  };
  const advance = () => {
    if (activeRequest.current || uncertain) return;
    const invalid = validateTaxForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (error !== 'uncertain') setError(null);
    setStep((previous) => Math.min(2, previous + 1));
  };
  const submit = async () => {
    if (activeRequest.current || uncertain || step !== 2) return;
    const invalid = validateTaxForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (mode === 'simulate' && !original) {
      setError('write');
      return;
    }
    const input = taxRequest(form);
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(mode);
    setError(null);
    setAcknowledged(false);
    try {
      const data =
        mode === 'simulate' && original
          ? await simulateTaxCheckApi(
              original,
              { income: input.income, conditions: input.conditions },
              controller.signal,
            )
          : await analyzeTaxCheckApi(input, controller.signal);
      if (activeRequest.current !== controller) return;
      if (mode === 'simulate') setScenario(data);
      else {
        setOriginal(data);
        setScenario(null);
        setForm(formFromTax(data));
        setSavedUrl(data.taxCheckId);
      }
      setStep(3);
    } catch (cause) {
      if (activeRequest.current === controller) {
        setError(
          cause instanceof TaxApiError && cause.saveUncertain
            ? 'uncertain'
            : 'write',
        );
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(null);
      }
    }
  };
  const errors: Record<PageError, string> = {
    year: copy.invalidYear,
    annualIncome: copy.invalidAmount,
    nonTaxableIncome: copy.invalidAmount,
    total: copy.tooLarge,
    read: copy.readError,
    write: copy.writeError,
    uncertain: copy.saveUncertain,
    url: copy.badUrl,
  };
  const steps = [
    copy.incomeStep,
    copy.housingStep,
    copy.reviewStep,
    copy.resultStep,
  ];
  const conditionQuestions: [keyof TaxConditions, string][] = [
    ['housingSaving', copy.housing],
    ['isHomeless', copy.homeless],
    ...(form.conditions.housingSaving === true
      ? [['housingSavingProof', copy.proof] as [keyof TaxConditions, string]]
      : []),
  ];

  return (
    <AppShell title={t('tab.tax')} subtitle={copy.intro}>
      <div className="space-y-5 pb-6">
        <aside className="space-y-2 rounded-2xl border border-border bg-card p-4 text-muted-foreground text-xs leading-relaxed">
          <p>{copy.notice}</p>
          <p>{copy.manual}</p>
          <p>{copy.originalText}</p>
        </aside>

        {busy && (
          <output aria-live="polite" className="text-muted-foreground text-sm">
            {pending === 'read'
              ? copy.loading
              : pending === 'simulate'
                ? copy.simulating
                : copy.saving}
          </output>
        )}
        {error && (
          <div
            role="alert"
            className="space-y-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm"
          >
            <p>{errors[error]}</p>
            {(error === 'read' || error === 'url' || error === 'uncertain') && (
              <Link href="/records" className="inline-block underline">
                {copy.records}
              </Link>
            )}
            {error === 'uncertain' && (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={busy}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                {copy.acknowledge}
              </label>
            )}
            {error === 'read' && loadId !== null && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void loadSaved(loadId)}
              >
                {copy.retry}
              </Button>
            )}
          </div>
        )}

        {step === -1 && (
          <section className="space-y-5 rounded-3xl bg-[#143463] p-6 text-white">
            <Receipt className="h-9 w-9" aria-hidden="true" />
            <h2 className="font-bold text-xl">TaxCheck</h2>
            <p className="text-sm leading-relaxed">{copy.limit}</p>
            <Button
              type="button"
              onClick={startNew}
              disabled={busy}
              className="bg-white text-[#143463] hover:bg-white/90"
            >
              {error ? copy.newAnalysis : t('common.start')}{' '}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </section>
        )}

        {step >= 0 && (
          <>
            <p className="font-semibold text-muted-foreground text-sm">
              {step + 1} / 4 · {steps[step]}
            </p>
            {mode === 'simulate' && (
              <p className="rounded-2xl border border-border bg-secondary p-4 text-sm leading-relaxed">
                {copy.simulationNotice}
              </p>
            )}
            {step < 3 && (
              <fieldset
                disabled={busy}
                className="space-y-5 rounded-3xl border border-border bg-card p-5"
              >
                <legend className="sr-only">{steps[step]}</legend>
                {step === 0 && (
                  <>
                    <label
                      htmlFor="tax-year"
                      className="block font-medium text-sm"
                    >
                      {copy.year}
                      <input
                        id="tax-year"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        className={inputClass}
                        disabled={mode === 'simulate'}
                        value={form.taxYear}
                        onChange={(event) =>
                          changeIncome({ taxYear: event.target.value })
                        }
                      />
                    </label>
                    {Number(form.taxYear) === koreaYear() &&
                      mode === 'analyze' && (
                        <p className="text-sm text-warn">{copy.currentYear}</p>
                      )}
                    <label
                      htmlFor="annual-income"
                      className="block font-medium text-sm"
                    >
                      {copy.annual}
                      <input
                        id="annual-income"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className={inputClass}
                        value={form.annualIncome}
                        onChange={(event) =>
                          changeIncome({ annualIncome: event.target.value })
                        }
                      />
                    </label>
                    <label
                      htmlFor="non-taxable-income"
                      className="block font-medium text-sm"
                    >
                      {copy.nonTaxable}
                      <input
                        id="non-taxable-income"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        className={inputClass}
                        value={form.nonTaxableIncome}
                        onChange={(event) =>
                          changeIncome({ nonTaxableIncome: event.target.value })
                        }
                      />
                    </label>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {copy.incomeHint}
                    </p>
                    <label
                      htmlFor="income-confirmed"
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        id="income-confirmed"
                        type="checkbox"
                        className="mt-1"
                        checked={form.confirmed}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            confirmed: event.target.checked,
                          }))
                        }
                      />
                      {mode === 'simulate'
                        ? copy.confirmScenario
                        : copy.confirm}
                    </label>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {copy.incomplete}
                    </p>
                  </>
                )}
                {step === 1 &&
                  conditionQuestions.map(([key, label]) => (
                    <Question
                      key={key}
                      name={key}
                      label={label}
                      value={form.conditions[key]}
                      copy={copy}
                      onChange={(value) => changeCondition(key, value)}
                    />
                  ))}
                {step === 2 && (
                  <>
                    <Question
                      name="usesDeductions"
                      label={copy.deductions}
                      value={form.conditions.usesDeductions}
                      copy={copy}
                      onChange={(value) =>
                        changeCondition('usesDeductions', value)
                      }
                    />
                    <p className="text-sm">
                      {mode === 'simulate'
                        ? copy.simulationNotice
                        : copy.review}
                    </p>
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">{copy.year}</dt>
                        <dd>{form.taxYear}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.annual}</dt>
                        <dd>
                          {taxMoney(
                            form.annualIncome.trim() === ''
                              ? null
                              : Number(form.annualIncome),
                            locale,
                            copy.unknown,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {copy.nonTaxable}
                        </dt>
                        <dd>
                          {taxMoney(
                            form.nonTaxableIncome.trim() === ''
                              ? null
                              : Number(form.nonTaxableIncome),
                            locale,
                            copy.unknown,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {mode === 'simulate'
                            ? copy.confirmScenario
                            : copy.confirm}
                        </dt>
                        <dd>{form.confirmed ? copy.yes : copy.unknown}</dd>
                      </div>
                      {conditionQuestions.map(([key, label]) => (
                        <div key={key}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd>
                            {form.conditions[key] === null
                              ? copy.unknown
                              : form.conditions[key]
                                ? copy.yes
                                : copy.no}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {copy.limit}
                    </p>
                  </>
                )}
                <div className="flex flex-wrap gap-3">
                  {step > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep((previous) => previous - 1)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('common.prev')}
                    </Button>
                  )}
                  {step < 2 ? (
                    <Button type="button" onClick={advance}>
                      {t('common.next')}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={busy || uncertain}
                      onClick={() => void submit()}
                      className="h-auto min-h-10 whitespace-normal"
                    >
                      {busy
                        ? mode === 'simulate'
                          ? copy.simulating
                          : copy.saving
                        : mode === 'simulate'
                          ? copy.runSimulation
                          : copy.save}
                    </Button>
                  )}
                </div>
              </fieldset>
            )}

            {step === 3 && displayed && (
              <>
                <TaxResultView data={displayed} copy={copy} locale={locale} />
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={startSimulation}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    {copy.simulate}
                  </Button>
                  {scenario && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={restoreOriginal}
                    >
                      {copy.restore}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || uncertain}
                    onClick={startNew}
                  >
                    {copy.newAnalysis}
                  </Button>
                </div>
              </>
            )}
            {mode === 'simulate' && step < 3 && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={restoreOriginal}
              >
                {copy.restore}
              </Button>
            )}
          </>
        )}
        <nav className="flex gap-5 text-sm" aria-label={copy.records}>
          <Link href="/records" className="underline underline-offset-4">
            {copy.records}
          </Link>
          <Link href="/dashboard" className="underline underline-offset-4">
            {copy.dashboard}
          </Link>
        </nav>
      </div>
    </AppShell>
  );
}
