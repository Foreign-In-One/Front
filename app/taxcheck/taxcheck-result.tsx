import { ExternalLink } from 'lucide-react';
import type { TaxResponse } from '@/services/taxcheck-api';
import type { TaxCopy } from './taxcheck-copy';
import { taxMoney } from './taxcheck-form';

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="font-semibold text-sm">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-xs">
        {items.map((item, index) => (
          <li key={`${index}:${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function TaxResultView({
  data,
  copy,
  locale,
}: {
  data: TaxResponse;
  copy: TaxCopy;
  locale: string;
}) {
  const money = (value: number | null) =>
    taxMoney(value, locale, copy.notCalculated);
  const { result, paySummary } = data;
  const status = (value: string) =>
    value === 'REVIEW_REQUIRED'
      ? copy.reviewRequired
      : value === 'UNKNOWN'
        ? copy.undetermined
        : value;
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="font-bold text-base">
          {data.simulation ? copy.simulation : copy.saved}
        </h2>
        <p className="text-muted-foreground text-xs">
          {data.simulation ? copy.source : copy.savedId}:{' '}
          {data.simulation ? data.sourceTaxCheckId : data.taxCheckId} ·{' '}
          {copy.year}: {data.taxYear}
        </p>
        <p className="text-muted-foreground text-xs">
          {data.simulation ? copy.sourceDate : copy.savedDate}:{' '}
          {data.analyzedAt.replace('T', ' ')}
        </p>
        <p className="text-sm">{result.analysisSummary}</p>
        <p className="text-muted-foreground text-xs">
          {copy.next}: {result.nextAction}
        </p>
        <div className="rounded-2xl bg-primary/10 p-4">
          <p className="text-sm">{copy.flat}</p>
          <p className="mt-1 font-bold text-2xl text-primary">
            {money(result.flatTaxEstimate)}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">
            {copy.base}: {money(result.calculation.incomeBase)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">{copy.general}</dt>
            <dd>{money(result.generalTaxEstimate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.difference}</dt>
            <dd>{money(result.taxDifference)}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-xs">{copy.limit}</p>
        <TextList
          title={copy.missingCalculation}
          items={result.calculation.missingFields}
        />
      </section>
      <section className="space-y-2 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-sm">
          {data.taxYear} · {copy.payTotal}
        </h2>
        <p className="font-bold">
          {paySummary.totalReceivedPay === null
            ? paySummary.recordedMonths === 0
              ? copy.noPay
              : copy.unknownPay
            : money(paySummary.totalReceivedPay)}
        </p>
        <p className="text-muted-foreground text-xs">
          {copy.recorded}: {paySummary.recordedMonths} · {copy.known}:{' '}
          {paySummary.amountKnownMonths}
        </p>
        {paySummary.missingAmountPeriods.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {copy.missingMonths}: {paySummary.missingAmountPeriods.join(', ')}
          </p>
        )}
        <p className="text-muted-foreground text-xs">{copy.payNote}</p>
        {data.simulation && (
          <p className="text-muted-foreground text-xs">{copy.snapshot}</p>
        )}
      </section>
      {result.cards.map((card) => (
        <section
          key={card.id}
          className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm"
        >
          <h2 className="font-bold text-sm">{card.title}</h2>
          <p className="text-warn text-xs">{status(card.status)}</p>
          <p className="text-sm">{card.summary}</p>
          <TextList title={copy.confirmedInfo} items={card.confirmed} />
          <TextList title={copy.missingInfo} items={card.missing} />
          <TextList title={copy.next} items={card.nextActions} />
          {card.evidence.length > 0 && (
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">{copy.evidence}</h3>
              <ul className="space-y-2 text-xs">
                {card.evidence.map((source, index) => (
                  <li key={`${index}:${source.url}`}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 text-primary underline"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
      <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
        <TextList title={copy.documents} items={result.requiredDocuments} />
        <TextList title={copy.warnings} items={result.calculation.warnings} />
      </section>
    </div>
  );
}
