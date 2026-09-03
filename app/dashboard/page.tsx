'use client';

import {
  CalendarClock,
  ChevronRight,
  History,
  Plane,
  Receipt,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { formatKDate, isoDate } from '@/lib/paycycle/format';
import { dDay } from '@/lib/paycycle/rule-engine';
import type { EventType } from '@/lib/paycycle/types';
import {
  type DashboardResponse,
  getDashboardApi,
  type RecordSummary,
  type RecordType,
} from '@/services/records-api';
import { usePayCycle } from '@/state/paycycle-context';
import {
  DASHBOARD_COPY,
  type DashboardCopy,
  dashboardMoney,
  dashboardStatusLabel,
} from './dashboard-copy';

const EVENT_TYPE_LABEL_KEY: Record<EventType, string> = {
  PAYDAY: 'cal.type.payday',
  PAYCHECK: 'cal.type.paycheck',
  TAX: 'cal.type.tax',
  EXIT: 'cal.type.exit',
  PERSONAL: 'cal.type.personal',
};

const RECORD_LABEL_KEY: Record<RecordType, string> = {
  PAYCHECK: 'tab.pay',
  TAX_CHECK: 'tab.tax',
  EXIT_CHECK: 'tab.exit',
};

type LoadState = { revision: number } & (
  | { phase: 'ready'; data: DashboardResponse }
  | { phase: 'error' }
);

function recordPeriod(record: RecordSummary, copy: DashboardCopy): string {
  if (record.type === 'PAYCHECK') return record.payPeriod ?? '—';
  if (record.type === 'TAX_CHECK')
    return `${copy.taxYear}: ${record.taxYear ?? '—'}`;
  return record.expectedExitDate ? formatKDate(record.expectedExitDate) : '—';
}

function SavedSummary({
  record,
  empty,
  copy,
}: {
  record: RecordSummary | null;
  empty: string;
  copy: DashboardCopy;
}) {
  if (!record)
    return <p className="mt-1 text-muted-foreground text-xs">{empty}</p>;
  return (
    <div className="mt-1 space-y-1 break-words text-muted-foreground text-xs">
      <p>
        {recordPeriod(record, copy)} ·{' '}
        {dashboardStatusLabel(record.status, copy)}
      </p>
      <p className="text-foreground">
        {record.analysisSummary || copy.summaryUnavailable}
      </p>
      {record.nextAction && (
        <p>
          {copy.nextAction}: {record.nextAction}
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { state, hydrated } = usePayCycle();
  const { t, locale } = useT();
  const copy = DASHBOARD_COPY[locale];
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<LoadState | null>(null);
  const current = load?.revision === revision ? load : null;
  const data = current?.phase === 'ready' ? current.data : null;

  useEffect(() => {
    const controller = new AbortController();
    getDashboardApi(controller.signal).then(
      (response) => {
        if (!controller.signal.aborted)
          setLoad({ revision, phase: 'ready', data: response });
      },
      () => {
        if (!controller.signal.aborted) setLoad({ revision, phase: 'error' });
      },
    );
    return () => controller.abort();
  }, [revision]);

  const profile = state.profile;
  const employment = state.employment;

  const exitIso =
    employment?.exitDate?.value && !employment.exitDate.unknown
      ? employment.exitDate.value
      : null;

  // 다가오는 일정 3개 (오늘 포함 이후 일정만)
  const today = isoDate(new Date());
  const upcomingEvents = useMemo(() => {
    return [...state.events]
      .filter((e) => !e.completed && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [state.events, today]);

  const defaultNickname = hydrated
    ? profile?.nickname || t('common.unknown')
    : t('common.unknown');

  return (
    <AppShell
      title={t('tab.home')}
      subtitle={t('home.myRights', { name: defaultNickname })}
    >
      <div className="space-y-5">
        <section className="space-y-2 rounded-3xl border border-border/80 bg-card p-4 text-muted-foreground text-xs">
          <p>{copy.notice}</p>
          <p>{copy.serverText}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!current}
            onClick={() => setRevision((value) => value + 1)}
          >
            {copy.refresh}
          </Button>
        </section>
        {!current && (
          <output className="block py-10 text-center text-muted-foreground text-sm">
            {t('home.loading')}
          </output>
        )}
        {current?.phase === 'error' && (
          <div
            role="alert"
            className="space-y-3 rounded-3xl border border-destructive/40 bg-card p-5"
          >
            <p className="text-sm">{copy.loadError}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              {copy.retry}
            </Button>
          </div>
        )}
        {data && (
          <>
            {/* 1. 상단 연간 급여 히어로 카드 (딥블루 그라데이션) */}
            <section
              aria-labelledby="dashboard-pay-title"
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#143463] via-[#1A417A] to-[#143463] p-6 text-white shadow-primary/20 shadow-xl transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="dashboard-pay-title"
                  className="font-semibold text-xs uppercase tracking-wider opacity-80"
                >
                  {data.year} · {copy.payTitle}
                </h2>
                <span className="rounded-xl bg-white/15 px-2.5 py-1 font-bold text-xs backdrop-blur">
                  {t('home.monthsRecorded', {
                    n: data.paySummary.recordedMonths,
                  })}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                {data.paySummary.totalReceivedPay !== null ? (
                  <span className="font-extrabold text-3xl tracking-tight">
                    {dashboardMoney(data.paySummary.totalReceivedPay, locale)}
                  </span>
                ) : (
                  <span className="font-bold text-white/90 text-xl tracking-tight">
                    {data.paySummary.recordedMonths === 0
                      ? t('home.noSalaryRecorded')
                      : copy.unknownAmount}
                  </span>
                )}
              </div>

              <p className="mt-2 text-white/80 text-xs">
                {copy.knownMonths}: {data.paySummary.amountKnownMonths} /{' '}
                {data.paySummary.recordedMonths}
              </p>
              {data.paySummary.missingAmountPeriods.length > 0 && (
                <p className="mt-1 text-white/80 text-xs">
                  {copy.missingMonths}:{' '}
                  {data.paySummary.missingAmountPeriods.join(', ')}
                </p>
              )}
              <p className="mt-2 text-white/80 text-xs">{copy.payHint}</p>

              <p className="mt-1 text-white/70 text-xs">
                {employment?.workplace ? `${employment.workplace} · ` : ''}
                {employment?.payDay
                  ? t('home.paydayInfo', { day: employment.payDay })
                  : ''}
              </p>

              <div className="mt-5 flex gap-2 border-white/15 border-t pt-3">
                <Link
                  href="/paycheck"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 font-bold text-[#143463] text-xs shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Wallet className="size-4" />
                  <span>{t('home.goPay')}</span>
                </Link>
                <Link
                  href="/records"
                  className="inline-flex items-center justify-center gap-1 rounded-2xl bg-white/15 px-3 py-2.5 font-semibold text-white text-xs backdrop-blur transition-colors hover:bg-white/25"
                >
                  <History className="size-4" />
                  <span>{t('records.nav')}</span>
                </Link>
              </div>
            </section>

            {/* 2. 3대 금융권리 상태 카드 (급여, 세금, 출국) */}
            <section className="space-y-3">
              <h2 className="font-bold text-foreground text-sm">
                {t('home.sec.financial')}
              </h2>
              <p className="text-muted-foreground text-xs">{copy.allYears}</p>

              <div className="grid gap-3">
                {/* 급여 (PayCheck) 상태 카드 */}
                <Link
                  href="/paycheck"
                  className="group flex items-center justify-between rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary transition-transform group-hover:scale-105">
                      <Wallet className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {t('tab.pay')} (PayCheck)
                        </span>
                        <span className="rounded-lg bg-signal/15 px-2 py-0.5 font-bold text-[10px] text-signal">
                          {t('home.badge.tripleCheck')}
                        </span>
                      </div>
                      <SavedSummary
                        record={data.latestPaycheck}
                        empty={copy.noPay}
                        copy={copy}
                      />
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>

                {/* 세금 (TaxCheck) 상태 카드 */}
                <Link
                  href="/taxcheck"
                  className="group flex items-center justify-between rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-2xl bg-purple-500/10 p-3 text-purple-600 transition-transform group-hover:scale-105 dark:text-purple-300">
                      <Receipt className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {t('tab.tax')} (TaxCheck)
                        </span>
                        <span className="rounded-lg bg-purple-500/15 px-2 py-0.5 font-bold text-[10px] text-purple-700 dark:text-purple-300">
                          {t('tab.tax')}
                        </span>
                      </div>
                      <SavedSummary
                        record={data.latestTaxCheck}
                        empty={copy.noTax}
                        copy={copy}
                      />
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>

                {/* 출국 (ExitCheck) 상태 카드 */}
                <Link
                  href="/exitcheck"
                  className="group flex items-center justify-between rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-2xl bg-warn/10 p-3 text-warn transition-transform group-hover:scale-105">
                      <Plane className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {t('tab.exit')} (ExitCheck)
                        </span>
                        <span className="rounded-lg bg-warn/15 px-2 py-0.5 font-bold text-[10px] text-warn">
                          {exitIso
                            ? t('home.exitDday', { n: dDay(exitIso) })
                            : t('home.exitNone')}
                        </span>
                      </div>
                      <SavedSummary
                        record={data.latestExitCheck}
                        empty={copy.noExit}
                        copy={copy}
                      />
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-foreground text-sm">
                  {copy.recent}
                </h2>
                <Link
                  href="/records"
                  className="font-bold text-primary text-xs hover:underline"
                >
                  {t('records.nav')}
                </Link>
              </div>
              {data.recentRecords.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {copy.emptyRecent}
                </p>
              ) : (
                data.recentRecords.map((record) => (
                  <article
                    key={record.recordKey}
                    aria-label={record.recordKey}
                    className="space-y-1 rounded-2xl bg-muted/40 p-3"
                  >
                    <h3 className="font-bold text-sm">
                      {t(RECORD_LABEL_KEY[record.type])}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {copy.recordedOn}:{' '}
                      {record.recordedAt
                        ? formatKDate(record.recordedAt.slice(0, 10))
                        : '—'}
                    </p>
                    <SavedSummary record={record} empty="" copy={copy} />
                  </article>
                ))
              )}
            </section>
          </>
        )}

        {/* 3. 다가오는 일정 캘린더 요약 */}
        <section className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground text-sm">
              {t('home.upcoming')}
            </h2>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1 font-bold text-primary text-xs hover:underline"
            >
              <span>{t('home.openCalendar')}</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {!hydrated ? (
            <p className="text-muted-foreground text-xs">{t('home.loading')}</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="py-2 text-muted-foreground text-xs">
              {t('home.noEvents')}
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded-2xl bg-muted/40 p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarClock className="size-4 text-primary" />
                    <div>
                      <span className="font-bold text-foreground">
                        {evt.title}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {formatKDate(evt.date)}{' '}
                        {evt.time ? `· ${evt.time}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-secondary px-2 py-0.5 font-semibold text-[10px] text-secondary-foreground">
                    {EVENT_TYPE_LABEL_KEY[evt.type]
                      ? t(EVENT_TYPE_LABEL_KEY[evt.type])
                      : evt.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
