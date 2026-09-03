"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  History,
  Plane,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  listSavedResults,
  removeSavedResult,
  type ResultKind,
  type SavedResult,
} from "@/lib/paycycle/result-storage";
import { formatKDate, won } from "@/lib/paycycle/format";
import { useT, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";

type FilterKind = ResultKind | "all";

const TABS: { key: FilterKind; labelKey: TKey }[] = [
  { key: "all", labelKey: "records.all" },
  { key: "pay", labelKey: "records.pay" },
  { key: "tax", labelKey: "records.tax" },
  { key: "exit", labelKey: "records.exit" },
];

const KIND_META: Record<ResultKind, { labelKey: TKey; icon: typeof Wallet; target: string }> = {
  pay: { labelKey: "tab.pay", icon: Wallet, target: "/paycheck" },
  tax: { labelKey: "tab.tax", icon: Receipt, target: "/taxcheck" },
  exit: { labelKey: "tab.exit", icon: Plane, target: "/exitcheck" },
};

export default function RecordsPage() {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [results, setResults] = useState<SavedResult[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { t } = useT();

  useEffect(() => {
    setResults(listSavedResults());
    setHydrated(true);
  }, []);

  const counts = useMemo(
    () => ({
      all: results.length,
      pay: results.filter((r) => r.kind === "pay").length,
      tax: results.filter((r) => r.kind === "tax").length,
      exit: results.filter((r) => r.kind === "exit").length,
    }),
    [results]
  );

  const visibleResults = useMemo(
    () => (filter === "all" ? results : results.filter((r) => r.kind === filter)),
    [filter, results]
  );

  const handleDelete = (result: SavedResult) => {
    const label = t(KIND_META[result.kind].labelKey);
    if (!window.confirm(`${label} ${t("common.delete")}?`)) return;

    if (!removeSavedResult(result.id)) {
      toast.error(t("common.delete"));
      return;
    }

    setResults((prev) => prev.filter((r) => r.id !== result.id));
    toast.success(t("records.deleted"));
  };

  if (!hydrated) {
    return (
      <AppShell title={t("records.title")}>
        <div className="py-20 text-center text-sm text-muted-foreground">
          {t("home.loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("records.title")} subtitle={t("records.subtitle")}>
      <div className="space-y-4">
        {/* 필터 탭 */}
        <div className="flex gap-2 rounded-2xl bg-muted/60 p-1.5 backdrop-blur">
          {TABS.map((tab) => {
            const active = filter === tab.key;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{t(tab.labelKey)}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px]",
                    active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 결과가 없을 때 */}
        {visibleResults.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center space-y-3">
            <History className="mx-auto size-10 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("records.empty")}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link
                href="/paycheck"
                className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                {t("home.goPay")}
              </Link>
              <Link
                href="/taxcheck"
                className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                {t("tab.tax")}
              </Link>
              <Link
                href="/exitcheck"
                className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                {t("tab.exit")}
              </Link>
            </div>
          </div>
        ) : (
          /* 기록 카드 목록 */
          <div className="space-y-3">
            {visibleResults.map((result) => {
              const meta = KIND_META[result.kind];
              const Icon = meta.icon;
              const isExpanded = expandedId === result.id;

              return (
                <div
                  key={result.id}
                  className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/30 space-y-3 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {t(meta.labelKey as any)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {t("records.savedAt", {
                              date: formatKDate(result.createdAt.split("T")[0]),
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                          {result.kind === "pay" &&
                            t("records.payLine", {
                              period: result.payPeriod,
                              workplace: result.workplace,
                            })}
                          {result.kind === "tax" &&
                            t("records.taxLine", {
                              year: result.year,
                              total: result.totalCount,
                              need: result.needsActionCount,
                            })}
                          {result.kind === "exit" &&
                            t("records.exitLine", {
                              done: result.readyCount,
                              total: result.totalCount,
                            })}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(result)}
                      className="size-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* 세금 확인 세부 카드 내용 펼치기 */}
                  {result.kind === "tax" && result.cards && result.cards.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : result.id)}
                        className="flex w-full items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <span>{t("records.detailsCard", { n: result.cards.length })}</span>
                        <ChevronDown
                          className={cn("size-4 transition-transform", isExpanded && "rotate-180")}
                        />
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 space-y-2 pt-1 border-t border-border/50">
                          {result.cards.map((card, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-border/60 bg-background/50 p-3 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground">
                                  {card.title}
                                </span>
                                <span className="text-[11px] font-semibold text-primary">
                                  {card.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {card.summary}
                              </p>
                              {card.nextActions.length > 0 && (
                                <p className="text-[11px] font-medium text-foreground">
                                  {t("records.nextActionPrefix", { action: card.nextActions[0] })}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 다시 확인하기 바로가기 */}
                  <div className="flex justify-end pt-1">
                    <Link
                      href={meta.target}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <span>{t("records.reCheck")}</span>
                      <RotateCcw className="size-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
