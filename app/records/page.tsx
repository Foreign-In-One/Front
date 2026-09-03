'use client';

import {
  ChevronDown,
  History,
  Plane,
  Receipt,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { type TKey, useT } from '@/i18n';
import { formatKDate } from '@/lib/paycycle/format';
import { formatKrw } from '@/lib/paycycle/money';
import { cn } from '@/lib/utils';
import {
  getRecordsApi,
  getStoredTaxCardsApi,
  type RecordCounts,
  type RecordsFilter,
  type RecordsResponse,
  type RecordType,
  type StoredTaxCard,
} from '@/services/records-api';
import { RECORDS_COPY, recordStatusLabel } from './records-copy';

type LoadState<T> = { requestKey: string } & (
  | { phase: 'ready'; data: T }
  | { phase: 'error' }
);

const TABS: {
  key: RecordsFilter;
  labelKey: TKey;
  countKey: keyof RecordCounts;
}[] = [
  { key: 'ALL', labelKey: 'records.all', countKey: 'all' },
  { key: 'PAYCHECK', labelKey: 'records.pay', countKey: 'paycheck' },
  { key: 'TAX_CHECK', labelKey: 'records.tax', countKey: 'taxCheck' },
  { key: 'EXIT_CHECK', labelKey: 'records.exit', countKey: 'exitCheck' },
];

const KIND_META: Record<
  RecordType,
  { labelKey: TKey; icon: typeof Wallet; target: string }
> = {
  PAYCHECK: { labelKey: 'tab.pay', icon: Wallet, target: '/paycheck' },
  TAX_CHECK: { labelKey: 'tab.tax', icon: Receipt, target: '/taxcheck' },
  EXIT_CHECK: { labelKey: 'tab.exit', icon: Plane, target: '/exitcheck' },
};

function StoredTaxDetails({ taxCheckId }: { taxCheckId: number }) {
  const { locale, t } = useT();
  const copy = RECORDS_COPY[locale] ?? RECORDS_COPY.ko;
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<LoadState<StoredTaxCard[]> | null>(null);
  const requestKey = `${taxCheckId}:${revision}`;
  const current = load?.requestKey === requestKey ? load : null;

  useEffect(() => {
    const controller = new AbortController();
    void getStoredTaxCardsApi(taxCheckId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setLoad({ requestKey, phase: 'ready', data });
      },
      () => {
        if (!controller.signal.aborted) setLoad({ requestKey, phase: 'error' });
      },
    );
    return () => controller.abort();
  }, [taxCheckId, requestKey]);

  if (!current)
    return (
      <output className="block p-3 text-muted-foreground text-xs">
        {t('home.loading')}
      </output>
    );
  if (current.phase === 'error') {
    return (
      <div role="alert" className="space-y-2 p-3 text-xs">
        <p>{copy.detailsError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRevision((n) => n + 1)}
        >
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (current.data.length === 0)
    return <p className="p-3 text-muted-foreground text-xs">{copy.noCards}</p>;

  return (
    <div className="mt-2.5 space-y-2 border-border/50 border-t pt-1">
      {current.data.map((card) => (
        <div
          key={card.id}
          className="space-y-1.5 rounded-2xl border border-border/60 bg-background/50 p-3 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-foreground">{card.title}</span>
            <span className="font-semibold text-[11px] text-primary">
              {recordStatusLabel(card.status, copy)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{card.summary}</p>
          {card.nextActions.length > 0 && (
            <p className="font-medium text-[11px] text-foreground">
              {t('records.nextActionPrefix', { action: card.nextActions[0] })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RecordsPage() {
  const [filter, setFilter] = useState<RecordsFilter>('ALL');
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<LoadState<RecordsResponse> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { locale, t } = useT();
  const copy = RECORDS_COPY[locale] ?? RECORDS_COPY.ko;
  const requestKey = `${filter}:${revision}`;
  // A just-changed tab must never render a response for the previous request.
  const current = load?.requestKey === requestKey ? load : null;
  const data = current?.phase === 'ready' ? current.data : null;
  const unknown = t('common.unknownValue');

  useEffect(() => {
    const controller = new AbortController();
    void getRecordsApi(filter, controller.signal).then(
      (response) => {
        if (!controller.signal.aborted) {
          setLoad({ requestKey, phase: 'ready', data: response });
        }
      },
      () => {
        if (!controller.signal.aborted) setLoad({ requestKey, phase: 'error' });
      },
    );
    return () => controller.abort();
  }, [filter, requestKey]);

  const refresh = () => {
    setExpandedId(null);
    setRevision((n) => n + 1);
  };

  return (
    <AppShell title={t('records.title')} subtitle={t('records.subtitle')}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3 text-muted-foreground text-xs">
          <p>{copy.notice}</p>
          <p>{copy.serverText}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={!current}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {copy.refresh}
          </Button>
        </div>

        <fieldset
          className="flex min-w-0 gap-2 rounded-2xl border-0 bg-muted/60 p-1.5 backdrop-blur"
          aria-label={t('records.title')}
        >
          {TABS.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setExpandedId(null);
                  setFilter(tab.key);
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-xs transition-all',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{t(tab.labelKey)}</span>
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px]',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {data ? data.counts[tab.countKey] : '—'}
                </span>
              </button>
            );
          })}
        </fieldset>

        {!current && (
          <output className="block py-16 text-center text-muted-foreground text-sm">
            {t('home.loading')}
          </output>
        )}

        {current?.phase === 'error' && (
          <div
            role="alert"
            className="space-y-3 rounded-3xl border border-destructive/40 bg-card p-6 text-center"
          >
            <p className="text-foreground text-sm">{copy.loadError}</p>
            <Button type="button" variant="outline" onClick={refresh}>
              {copy.retry}
            </Button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="space-y-3 rounded-3xl border border-border border-dashed bg-card/60 p-8 text-center">
            <History
              className="mx-auto size-10 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              {copy.empty}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {Object.entries(KIND_META).map(([type, meta]) => (
                <Link
                  key={type}
                  href={meta.target}
                  className="rounded-xl bg-secondary px-3 py-1.5 font-semibold text-secondary-foreground text-xs hover:bg-secondary/80"
                >
                  {t(meta.labelKey)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="space-y-3">
            {data.items.map((record) => {
              const meta = KIND_META[record.type];
              const Icon = meta.icon;
              const isExpanded = expandedId === record.recordKey;
              const detailsId = `tax-details-${record.sourceId}`;
              const date = record.recordedAt
                ? formatKDate(record.recordedAt.slice(0, 10))
                : unknown;

              return (
                <article
                  key={record.recordKey}
                  aria-label={record.recordKey}
                  className="space-y-3 rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/30 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="font-bold text-foreground text-xs">
                          {t(meta.labelKey)}
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                          {copy.recordedOn}: {date}
                        </p>
                      </div>
                    </div>
                    <StatusPill
                      tone={
                        record.type === 'PAYCHECK' && record.status === 'NORMAL'
                          ? 'ok'
                          : 'neutral'
                      }
                    >
                      {recordStatusLabel(record.status, copy)}
                    </StatusPill>
                  </div>

                  <p className="font-medium text-muted-foreground text-xs">
                    {record.type === 'PAYCHECK' && (
                      <>
                        {record.payPeriod ?? unknown} · {copy.receivedPay}:{' '}
                        {formatKrw(record.actualAmount, locale, unknown)}
                      </>
                    )}
                    {record.type === 'TAX_CHECK' && (
                      <>
                        {copy.taxYear}: {record.taxYear ?? unknown}
                      </>
                    )}
                    {record.type === 'EXIT_CHECK' && (
                      <>
                        {copy.exitDate}:{' '}
                        {record.expectedExitDate
                          ? formatKDate(record.expectedExitDate)
                          : unknown}{' '}
                        · {copy.readiness}: {record.readinessScore ?? unknown}
                      </>
                    )}
                  </p>
                  <p className="break-words text-foreground text-sm">
                    {record.analysisSummary || copy.summaryUnavailable}
                  </p>
                  {record.nextAction && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t('records.nextActionPrefix', {
                        action: record.nextAction,
                      })}
                    </p>
                  )}

                  {record.type === 'TAX_CHECK' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : record.recordKey)
                        }
                        className="flex w-full items-center justify-between rounded-xl bg-muted/40 px-3 py-2 font-semibold text-muted-foreground text-xs hover:text-foreground"
                      >
                        <span>{copy.details}</span>
                        <ChevronDown
                          className={cn(
                            'size-4 transition-transform',
                            isExpanded && 'rotate-180',
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      <div id={detailsId}>
                        {isExpanded && (
                          <StoredTaxDetails
                            key={record.recordKey}
                            taxCheckId={record.sourceId}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Link
                      href={meta.target}
                      className="inline-flex items-center gap-1 font-bold text-primary text-xs hover:underline"
                    >
                      <span>{t('records.reCheck')}</span>
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
