"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  History,
  Plane,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { usePayCycle } from "@/state/paycycle-context";
import { useT } from "@/i18n";
import { formatKDate, isoDate, won } from "@/lib/paycycle/format";
import { listSavedResults, type SavedResult } from "@/lib/paycycle/result-storage";
import { dDay } from "@/lib/paycycle/rule-engine";
import type { EventType } from "@/lib/paycycle/types";
import { cn } from "@/lib/utils";

const EVENT_TYPE_LABEL_KEY: Record<EventType, string> = {
  PAYDAY: "cal.type.payday",
  PAYCHECK: "cal.type.paycheck",
  TAX: "cal.type.tax",
  EXIT: "cal.type.exit",
  PERSONAL: "cal.type.personal",
};

export default function DashboardPage() {
  const { state, hydrated, yearlyPay, monthsRecorded } = usePayCycle();
  const { t } = useT();

  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);

  useEffect(() => {
    setSavedResults(listSavedResults());
  }, []);

  const profile = state.profile;
  const employment = state.employment;

  const latestPayRecord = state.payRecords[0];
  const latestTaxResult = useMemo(
    () => savedResults.find((r) => r.kind === "tax"),
    [savedResults]
  );
  const latestExitResult = useMemo(
    () => savedResults.find((r) => r.kind === "exit"),
    [savedResults]
  );

  const displayYearlyPay =
    yearlyPay > 0
      ? yearlyPay
      : latestTaxResult && "yearlyPay" in latestTaxResult && latestTaxResult.yearlyPay
        ? latestTaxResult.yearlyPay
        : null;

  const displayMonths =
    monthsRecorded > 0
      ? monthsRecorded
      : latestTaxResult && "monthsRecorded" in latestTaxResult && latestTaxResult.monthsRecorded
        ? latestTaxResult.monthsRecorded
        : null;

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

  if (!hydrated) {
    return (
      <AppShell title={t("tab.home")}>
        <div className="py-20 text-center text-sm text-muted-foreground">
          {t("home.loading")}
        </div>
      </AppShell>
    );
  }

  const defaultNickname = profile?.nickname || t("common.unknown");

  return (
    <AppShell
      title={t("tab.home")}
      subtitle={t("home.myRights", { name: defaultNickname })}
    >
      <div className="space-y-5">
        {/* 1. 상단 연간 급여 히어로 카드 (딥블루 그라데이션) */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#143463] via-[#1A417A] to-[#143463] p-6 text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
              {t("home.yearly")}
            </span>
            {displayMonths !== null ? (
              <span className="rounded-xl bg-white/15 px-2.5 py-1 text-xs font-bold backdrop-blur">
                {t("home.monthsRecorded", { n: displayMonths })}
              </span>
            ) : (
              <span className="rounded-xl bg-white/15 px-2.5 py-1 text-xs font-bold backdrop-blur">
                {t("common.unknownValue")}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            {displayYearlyPay !== null ? (
              <span className="text-3xl font-extrabold tracking-tight">
                {won(displayYearlyPay)}
              </span>
            ) : (
              <span className="text-xl font-bold tracking-tight text-white/90">
                {t("home.noSalaryRecorded")}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-white/70">
            {employment?.workplace ? `${employment.workplace} · ` : ""}
            {employment?.payDay ? t("home.paydayInfo", { day: employment.payDay }) : ""}
          </p>

          <div className="mt-5 flex gap-2 pt-3 border-t border-white/15">
            <Link
              href="/paycheck"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white text-primary px-4 py-2.5 text-xs font-bold shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Wallet className="size-4" />
              <span>{t("home.goPay")}</span>
            </Link>
            <Link
              href="/records"
              className="inline-flex items-center justify-center gap-1 rounded-2xl bg-white/15 px-3 py-2.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/25 transition-colors"
            >
              <History className="size-4" />
              <span>{t("records.nav")}</span>
            </Link>
          </div>
        </section>

        {/* 2. 3대 금융권리 상태 카드 (급여, 세금, 출국) */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            {t("home.sec.financial")}
          </h2>

          <div className="grid gap-3">
            {/* 급여 (PayCheck) 상태 카드 */}
            <Link
              href="/paycheck"
              className="group flex items-center justify-between rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary transition-transform group-hover:scale-105">
                  <Wallet className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {t("tab.pay")} (PayCheck)
                    </span>
                    <span className="rounded-lg bg-signal/15 px-2 py-0.5 text-[10px] font-bold text-signal">
                      {t("home.badge.tripleCheck")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {latestPayRecord
                      ? `${latestPayRecord.period} · ${
                          latestPayRecord.analysis.overallStatus === "MATCH"
                            ? t("home.paycheckMatch")
                            : t("home.paycheckNeedsAction")
                        }`
                      : t("home.paycheckLead")}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>

            {/* 세금 (TaxCheck) 상태 카드 */}
            <Link
              href="/taxcheck"
              className="group flex items-center justify-between rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-purple-500/10 p-3 text-purple-600 dark:text-purple-300 transition-transform group-hover:scale-105">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {t("tab.tax")} (TaxCheck)
                    </span>
                    <span className="rounded-lg bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      {t("tab.tax")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {latestTaxResult && "applicableCount" in latestTaxResult
                      ? t("home.taxResultLine", {
                          applicable: latestTaxResult.applicableCount,
                          needsAction: latestTaxResult.needsActionCount,
                        })
                      : t("home.taxLead")}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>

            {/* 출국 (ExitCheck) 상태 카드 */}
            <Link
              href="/exitcheck"
              className="group flex items-center justify-between rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-warn/10 p-3 text-warn transition-transform group-hover:scale-105">
                  <Plane className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {t("tab.exit")} (ExitCheck)
                    </span>
                    <span className="rounded-lg bg-warn/15 px-2 py-0.5 text-[10px] font-bold text-warn">
                      {exitIso ? t("home.exitDday", { n: dDay(exitIso) }) : t("home.exitNone")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {latestExitResult && "readyCount" in latestExitResult
                      ? t("home.exitResultLine", {
                          ready: latestExitResult.readyCount,
                          total: latestExitResult.totalCount,
                        })
                      : t("home.exitLead")}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        {/* 3. 다가오는 일정 캘린더 요약 */}
        <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              {t("home.upcoming")}
            </h2>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <span>{t("home.openCalendar")}</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {t("home.noEvents")}
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
                        {formatKDate(evt.date)} {evt.time ? `· ${evt.time}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                    {EVENT_TYPE_LABEL_KEY[evt.type] ? t(EVENT_TYPE_LABEL_KEY[evt.type] as any) : evt.type}
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
