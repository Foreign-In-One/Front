'use client';

import { ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { DateField, dateFieldValid } from '@/components/date-field';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';
import { VISA_CODES, visaInfo } from '@/i18n/visa';
import type {
  DateValue,
  EmploymentProfile,
  EmploymentStatus,
  LanguageCode,
} from '@/lib/paycycle/types';
import { EMPTY_DATE } from '@/lib/paycycle/types';
import { usePayCycle } from '@/state/paycycle-context';

const NATIONALITIES = [
  '베트남',
  '캄보디아',
  '태국',
  '인도네시아',
  '네팔',
  '필리핀',
];

const DEFAULT_LANG: Record<string, LanguageCode> = {
  베트남: 'vi',
  캄보디아: 'km',
  태국: 'th',
  인도네시아: 'id',
  네팔: 'ne',
  필리핀: 'tl',
};

interface Draft {
  nickname: string;
  nationality: string;
  visa: string;
  language: LanguageCode | '';
  status: EmploymentStatus | '';
  entryDate: DateValue;
  workStartDate: DateValue;
  currentWorkplaceStartDate: DateValue;
  exitDate: DateValue;
  payDay: number | null;
  payDayUnknown: boolean;
  workplace: string;
  previousWorkplace: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { saveProfile, state } = usePayCycle();
  const { locale, t } = useT();
  const e = state.employment;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [visaOpen, setVisaOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    nickname: state.profile?.nickname ?? '',
    nationality: state.profile?.nationality ?? '',
    visa: state.profile?.visa ?? '',
    language: state.profile?.language ?? '',
    status: state.employment?.status ?? '',
    entryDate: e?.entryDate ?? EMPTY_DATE,
    workStartDate: e?.workStartDate ?? EMPTY_DATE,
    currentWorkplaceStartDate: e?.currentWorkplaceStartDate ?? EMPTY_DATE,
    exitDate: e?.exitDate ?? EMPTY_DATE,
    payDay: e?.payDay ?? null,
    payDayUnknown: false,
    workplace: e?.workplace ?? '',
    previousWorkplace: e?.previousWorkplace ?? '',
  });

  const set = (patch: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const working = draft.status === 'EMPLOYED' || draft.status === 'CHANGING';
  const worked = draft.status !== 'PRE_EMPLOYMENT' && draft.status !== '';

  const entryRule = { noFuture: true };
  const workStartRule = {
    noFuture: true,
    notBefore: draft.entryDate.value
      ? { iso: draft.entryDate.value, label: '입국일' }
      : undefined,
  };
  const currentStartRule = {
    noFuture: true,
    notBefore: draft.workStartDate.value
      ? { iso: draft.workStartDate.value, label: '최초 근무일' }
      : undefined,
  };
  const exitRule = { noPast: true };

  const STATUS_OPTIONS: {
    value: EmploymentStatus;
    label: string;
    desc: string;
  }[] = [
    {
      value: 'PRE_EMPLOYMENT',
      label: t('ob.status.pre'),
      desc: t('ob.status.pre.d'),
    },
    {
      value: 'EMPLOYED',
      label: t('ob.status.employed'),
      desc: t('ob.status.employed.d'),
    },
    {
      value: 'SEPARATED',
      label: t('ob.status.separated'),
      desc: t('ob.status.separated.d'),
    },
    {
      value: 'CHANGING',
      label: t('ob.status.changing'),
      desc: t('ob.status.changing.d'),
    },
  ];

  type Step = {
    key: string;
    question: string;
    hint: string;
    valid: boolean;
    body: ReactNode;
  };

  /** 선택형 답변은 고르는 즉시 다음 단계로 넘어간다. */
  const advance = () => window.setTimeout(() => setStep((s) => s + 1), 180);

  const allSteps: (Step & { show: boolean })[] = [
    {
      key: 'nickname',
      show: true,
      question: t('ob.q.nickname'),
      hint: t('ob.h.nickname'),
      valid: draft.nickname.trim().length > 0,
      body: (
        <Input
          value={draft.nickname}
          onChange={(ev) => set({ nickname: ev.target.value })}
          placeholder={t('ob.nickname.placeholder')}
          aria-label={t('ob.q.nickname')}
          className="h-14 text-lg"
        />
      ),
    },
    {
      key: 'status',
      show: true,
      question: t('ob.q.status'),
      hint: t('ob.h.status'),
      valid: draft.status !== '',
      body: (
        <div className="space-y-3">
          {STATUS_OPTIONS.map((option) => {
            const active = draft.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  set({ status: option.value });
                  advance();
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.99] ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                <p className="font-bold text-base">{option.label}</p>
                <p
                  className={`mt-1 text-xs ${active ? 'opacity-85' : 'text-muted-foreground'}`}
                >
                  {option.desc}
                </p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'nationality',
      show: true,
      question: t('ob.q.nationality'),
      hint: t('ob.h.nationality'),
      valid: draft.nationality !== '',
      body: (
        <ChoiceGrid
          options={NATIONALITIES}
          value={draft.nationality}
          onSelect={(v) => {
            set({ nationality: v, language: DEFAULT_LANG[v] ?? 'en' });
            advance();
          }}
        />
      ),
    },
    {
      key: 'visa',
      show: true,
      question: t('ob.q.visa'),
      hint: t('ob.h.visa'),
      valid: draft.visa !== '',
      body: (
        <div className="grid grid-cols-2 gap-3">
          {VISA_CODES.map((code) => {
            const active = draft.visa === code;
            return (
              <div key={code} className="space-y-1.5">
                <div
                  className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition-all ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-md'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left font-semibold text-base"
                    onClick={() => {
                      set({ visa: code });
                      advance();
                    }}
                  >
                    {code}
                  </button>
                  <button
                    type="button"
                    aria-label={t('ob.visaInfoAria', { code })}
                    onClick={() => setVisaOpen(visaOpen === code ? null : code)}
                    className="ml-2 opacity-70"
                  >
                    <Info className="size-4" />
                  </button>
                </div>
                {visaOpen === code ? (
                  <p className="rounded-xl bg-secondary px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                    {visaInfo(locale, code)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: 'entryDate',
      show: true,
      question: t('ob.q.entry'),
      hint: t('ob.h.entry'),
      valid: dateFieldValid(draft.entryDate, entryRule),
      body: (
        <DateField
          label={t('ob.label.entry')}
          value={draft.entryDate}
          rule={entryRule}
          allowUnknown={false}
          onChange={(v) => set({ entryDate: v })}
        />
      ),
    },
    {
      key: 'workStartDate',
      show: worked,
      question: t('ob.q.workStart'),
      hint: t('ob.h.workStart'),
      valid: dateFieldValid(draft.workStartDate, workStartRule),
      body: (
        <DateField
          label={t('ob.label.workStart')}
          value={draft.workStartDate}
          rule={workStartRule}
          onChange={(v) => set({ workStartDate: v })}
        />
      ),
    },
    {
      key: 'workplace',
      show: worked,
      question: working ? t('ob.q.workplaceNow') : t('ob.q.workplacePast'),
      hint: t('ob.h.workplace'),
      valid: draft.workplace.trim().length > 0,
      body: (
        <div className="space-y-3">
          <Input
            value={draft.workplace}
            onChange={(ev) => set({ workplace: ev.target.value })}
            placeholder={t('ob.workplace.placeholder')}
            aria-label={t('ob.workplace.aria')}
            className="h-14 text-lg"
          />
          {draft.status === 'CHANGING' || draft.status === 'SEPARATED' ? (
            <Input
              value={draft.previousWorkplace}
              onChange={(ev) => set({ previousWorkplace: ev.target.value })}
              placeholder={t('ob.prevWorkplace.placeholder')}
              aria-label={t('ob.prevWorkplace.aria')}
              className="h-14 text-base"
            />
          ) : null}
        </div>
      ),
    },
    {
      key: 'currentWorkplaceStartDate',
      show: working,
      question: t('ob.q.currentStart'),
      hint: t('ob.h.currentStart'),
      valid: dateFieldValid(draft.currentWorkplaceStartDate, currentStartRule),
      body: (
        <DateField
          label={t('ob.label.currentStart')}
          value={draft.currentWorkplaceStartDate}
          rule={currentStartRule}
          onChange={(v) => set({ currentWorkplaceStartDate: v })}
        />
      ),
    },
    {
      key: 'payDay',
      show: worked,
      question: t('ob.q.payDay'),
      hint: t('ob.h.payDay'),
      valid: draft.payDayUnknown || draft.payDay !== null,
      body: (
        <div className="space-y-3">
          <ChoiceGrid
            options={['5', '10', '15', '20', '25', t('ob.payDay.lastDay')]}
            value={
              draft.payDayUnknown
                ? ''
                : draft.payDay === null
                  ? ''
                  : draft.payDay === 31
                    ? t('ob.payDay.lastDay')
                    : String(draft.payDay)
            }
            onSelect={(v) => {
              set({
                payDay: v === t('ob.payDay.lastDay') ? 31 : Number(v),
                payDayUnknown: false,
              });
              advance();
            }}
            suffix="일"
          />
          <button
            type="button"
            onClick={() =>
              set({ payDayUnknown: !draft.payDayUnknown, payDay: null })
            }
            className={`rounded-full border px-3.5 py-2 font-semibold text-xs ${
              draft.payDayUnknown
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {t('ob.payDayUnknown')}
          </button>
        </div>
      ),
    },
    {
      key: 'exitDate',
      show: true,
      question: t('ob.q.exit'),
      hint: t('ob.h.exit'),
      valid: dateFieldValid(draft.exitDate, exitRule),
      body: (
        <DateField
          label={t('ob.label.exit')}
          value={draft.exitDate}
          rule={exitRule}
          onChange={(v) => set({ exitDate: v })}
        />
      ),
    },
  ];

  const steps = allSteps.filter((s) => s.show);
  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];

  if (!current) return null;

  const progress = ((safeStep + 1) / steps.length) * 100;

  const finish = () => {
    const employment: EmploymentProfile = {
      status: (draft.status || 'EMPLOYED') as EmploymentStatus,
      entryDate: draft.entryDate,
      workStartDate: worked ? draft.workStartDate : EMPTY_DATE,
      currentWorkplaceStartDate: working
        ? draft.currentWorkplaceStartDate
        : EMPTY_DATE,
      exitDate: draft.exitDate,
      payDay: draft.payDayUnknown ? null : draft.payDay,
      workplace: draft.workplace.trim(),
      previousWorkplace: draft.previousWorkplace.trim(),
    };
    saveProfile(
      {
        nickname: draft.nickname.trim(),
        nationality: draft.nationality,
        visa: draft.visa,
        language: (draft.language || 'en') as LanguageCode,
      },
      employment,
    );
    setDone(true);
  };

  const next = () => {
    if (!current.valid) return;
    if (safeStep < steps.length - 1) setStep(safeStep + 1);
    else finish();
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="pc-rise w-full max-w-sm text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-signal-soft">
            <Check className="size-9 text-signal-foreground" />
          </div>
          <h1 className="mt-6 whitespace-pre-line font-bold text-2xl text-foreground">
            {t('ob.done.title')}
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            {draft.nationality} · {draft.visa} ·{' '}
            {STATUS_OPTIONS.find((s) => s.value === draft.status)?.label}
            <br />
            {t('ob.done.sub')}
          </p>
          <Button
            className="mt-8 h-14 w-full rounded-2xl font-bold text-base"
            onClick={() => router.push('/dashboard')}
          >
            {t('ob.done.cta')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t('common.prev')}
            onClick={() =>
              safeStep === 0 ? router.push('/') : setStep(safeStep - 1)
            }
            className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-semibold text-muted-foreground text-xs">
            {safeStep + 1}/{steps.length}
          </span>
          <LanguageSwitcher />
        </div>

        <div key={current.key} className="pc-rise mt-12">
          <h1 className="font-bold text-2xl text-foreground leading-snug">
            {current.question}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">{current.hint}</p>
          <div className="mt-8">{current.body}</div>
        </div>
      </div>

      <div className="mx-auto mt-auto w-full max-w-xl pt-10">
        <Button
          disabled={!current.valid}
          onClick={next}
          className="h-14 w-full rounded-2xl font-bold text-base"
        >
          {safeStep === steps.length - 1 ? t('ob.finish') : t('common.next')}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ChoiceGrid({
  options,
  value,
  onSelect,
  suffix = '',
}: {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-2xl border px-4 py-4 font-semibold text-base transition-all active:scale-[0.98] ${
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border bg-card text-foreground'
            }`}
          >
            {option}
            {/^\d+$/.test(option) ? suffix : ''}
          </button>
        );
      })}
    </div>
  );
}
