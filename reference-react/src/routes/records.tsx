import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History, Plane, Receipt, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { usePayCycle } from "@/state/paycycle-context";
import { useT, type UiLocale } from "@/i18n";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/paycycle/rule-engine";
import { won } from "@/lib/paycycle/format";
import type { ResultKind, SavedResult } from "@/lib/paycycle/results";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "내 확인 기록 · PayCycle AI" },
      {
        name: "description",
        content:
          "저장된 급여 확인, 연말정산 확인, 출국 정산 결과를 한 곳에서 다시 보고 필요한 항목을 다시 확인합니다.",
      },
      { property: "og:title", content: "내 확인 기록 · PayCycle AI" },
      {
        property: "og:description",
        content: "지금까지 확인한 급여·세금·출국 결과를 다시 볼 수 있습니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordsPage,
});

const BCP47: Record<UiLocale, string> = {
  ko: "ko-KR",
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
};

const ICON = { pay: Wallet, tax: Receipt, exit: Plane } as const;
const TARGET = { pay: "/paycheck", tax: "/taxcheck", exit: "/exitcheck" } as const;

function RecordsPage() {
  const { results, removeResult, isStale, hydrated } = usePayCycle();
  const { t, locale } = useT();
  const [filter, setFilter] = useState<ResultKind | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? results : results.filter((r) => r.kind === filter)),
    [results, filter],
  );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(BCP47[locale] ?? "ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const summary = (r: SavedResult) => {
    if (r.kind === "pay")
      return t("records.payLine", {
        period: r.payPeriod,
        workplace: r.workplace || t("common.unknown"),
      });
    if (r.kind === "tax")
      return t("records.taxLine", {
        year: r.year,
        total: r.totalCount,
        need: r.needsActionCount,
      });
    return t("records.exitLine", { done: r.readyCount, total: r.totalCount });
  };

  const tabs: (ResultKind | "all")[] = ["all", "pay", "tax", "exit"];

  return (
    <AppShell title={t("records.title")} subtitle={t("records.subtitle")}>
      <div className="flex gap-2">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`flex-1 rounded-xl border py-2.5 text-xs font-bold ${
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t(`records.${k === "all" ? "all" : k}`)}
          </button>
        ))}
      </div>

      {!hydrated ? null : visible.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-card p-6 text-center text-sm leading-relaxed text-muted-foreground shadow-sm">
          {t("records.empty")}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {visible.map((r) => {
            const Icon = ICON[r.kind];
            return (
              <li key={r.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Icon className="size-3.5 text-primary" />
                      {t("records.savedAt", { date: fmt(r.createdAt) })}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-foreground">{summary(r)}</p>
                    {r.kind === "pay" ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {won(r.paidAmount)}
                        {r.differenceAmount ? ` · ${won(r.differenceAmount)}` : ""}
                      </p>
                    ) : null}
                  </div>
                  {r.kind === "pay" ? (
                    <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
                  ) : null}
                </div>

                {isStale(r) ? (
                  <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-[11px] font-semibold text-warn-foreground">
                    {t("records.stale")}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between">
                  <Link to={TARGET[r.kind]} className="text-xs font-bold text-primary">
                    {t("records.reCheck")}
                  </Link>
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    onClick={() => {
                      void removeResult(r.id).then(() => toast.success(t("records.deleted")));
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" /> {t("common.delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <History className="size-3.5" /> {t("profile.privacy")}
      </p>
    </AppShell>
  );
}
