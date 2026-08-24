import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, History, Plane, Receipt, Sparkles, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { CountUp } from "@/components/count-up";
import { Button } from "@/components/ui/button";
import { usePayCycle } from "@/state/paycycle-context";
import { useT } from "@/i18n";
import {
  STATUS_LABEL,
  STATUS_TONE,
  dDay,
  evaluateExit,
  evaluateTax,
  monthsWorked,
} from "@/lib/paycycle/rule-engine";
import { formatKDate, isoDate, monthLabel, won } from "@/lib/paycycle/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "내 금융권리 대시보드 · PayCycle AI" },
      {
        name: "description",
        content:
          "이번 달 급여 확인 상태, 올해 누적 급여, 연말정산 확인 항목, 출국까지 남은 기간을 한 화면에서 확인합니다.",
      },
      { property: "og:title", content: "내 금융권리 대시보드 · PayCycle AI" },
      {
        property: "og:description",
        content: "급여·세금·출국 정산 상태를 한 화면에서 확인하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state, hydrated, yearlyPay, monthsRecorded, loadSample, results } = usePayCycle();
  const recent = useMemo(() => results.slice(0, 3), [results]);

  const { t } = useT();
  const profile = state.profile;
  const employment = state.employment;

  const latest = useMemo(
    () => [...state.payRecords].sort((a, b) => b.period.localeCompare(a.period))[0],
    [state.payRecords],
  );

  const taxCards = useMemo(
    () =>
      evaluateTax({
        employment,
        yearlyPay,
        monthsRecorded,
        taxProfile: state.taxProfile,
      }),
    [employment, yearlyPay, monthsRecorded, state.taxProfile],
  );

  const exitClaims = useMemo(
    () =>
      evaluateExit({
        employment,
        exitProfile: state.exitProfile,
        totalMonths: monthsWorked(employment),
      }),
    [employment, state.exitProfile],
  );

  const taxNeedsAction = taxCards.filter((c) => c.status === "추가 자료 필요").length;
  const exitNeedsAction = exitClaims.filter(
    (c) => c.status === "추가 자료 필요" || c.status === "현재 정보로 판단 불가",
  ).length;

  const exit = employment?.exitDate;
  const exitIso = exit && !exit.unknown && exit.value ? exit.value : null;

  const today = isoDate(new Date());
  const upcoming = [...state.events]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  if (!hydrated) {
    return (
      <AppShell title={t("dash.title")}>
        <p className="text-sm text-muted-foreground">{t("home.loading")}</p>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title={t("dash.title")} subtitle={t("home.needProfile")}>
        <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
          <p className="text-base font-bold text-foreground">{t("home.noProfileTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("home.noProfileDesc")}</p>
          <Link
            to="/onboarding"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-bold text-primary-foreground"
          >
            {t("home.createProfile")} <ArrowRight className="size-4" />
          </Link>
          <Button variant="secondary" className="mt-3 w-full" onClick={loadSample}>
            <Sparkles className="size-4" /> {t("home.trySample")}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("home.myRights", { name: profile.nickname })}
      subtitle={`${profile.nationality} · ${profile.visa} · ${employment?.workplace || t("home.noWorkplace")}`}
    >
      {state.sampleMode ? (
        <p className="mb-3 rounded-xl bg-info-soft px-3 py-2 text-xs font-semibold text-info-foreground">
          {t("home.sampleBanner")}
        </p>
      ) : null}

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20">
        <p className="text-xs font-semibold opacity-80">{t("home.yearly")}</p>
        <p className="mt-1 text-3xl font-bold">
          <CountUp value={yearlyPay} />
        </p>
        <p className="mt-1 text-xs opacity-80">{t("home.monthsRecorded", { n: monthsRecorded })}</p>
      </section>

      <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">{t("home.thisMonth")}</h2>
          </div>
          {latest ? (
            <StatusPill tone={STATUS_TONE[latest.analysis.overallStatus]}>
              {STATUS_LABEL[latest.analysis.overallStatus]}
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">{t("home.beforeCheck")}</StatusPill>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {latest
            ? t("home.paySummary", {
                month: monthLabel(latest.period),
                amount: won(latest.paidAmount),
                headline: latest.analysis.headline,
              })
            : t("home.payEmpty")}
        </p>
        <Link
          to="/paycheck"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
        >
          {t("home.goPay")} <ArrowRight className="size-4" />
        </Link>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/taxcheck" className="rounded-2xl bg-card p-4 shadow-sm">
          <Receipt className="size-4 text-primary" />
          <p className="mt-2 text-sm font-bold text-foreground">TaxCheck</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("home.taxItems", { n: taxCards.length })}
            {taxNeedsAction ? t("home.needDocs", { n: taxNeedsAction }) : ""}
          </p>
        </Link>
        <Link to="/exitcheck" className="rounded-2xl bg-card p-4 shadow-sm">
          <Plane className="size-4 text-primary" />
          <p className="mt-2 text-sm font-bold text-foreground">ExitCheck</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {exitIso ? t("home.exitDday", { n: dDay(exitIso) }) : t("home.exitNone")}
            {exitNeedsAction ? t("home.needCheck", { n: exitNeedsAction }) : ""}
          </p>
        </Link>
      </section>

      <section className="mt-3 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">{t("dash.recent")}</h2>
          </div>
          <Link to="/records" className="text-xs font-bold text-primary">
            {t("records.openList")}
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {recent.length === 0 ? (
            <li className="text-xs text-muted-foreground">{t("dash.recentEmpty")}</li>
          ) : (
            recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-bold text-muted-foreground">
                  {r.createdAt.slice(5, 10).replace("-", ".")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {r.kind === "pay"
                    ? t("records.payLine", {
                        period: r.payPeriod,
                        workplace: r.workplace || t("home.noWorkplace"),
                      })
                    : r.kind === "tax"
                      ? t("records.taxLine", {
                          year: r.year,
                          total: r.totalCount,
                          need: r.needsActionCount,
                        })
                      : t("records.exitLine", { done: r.readyCount, total: r.totalCount })}
                </span>
                <StatusPill tone={r.kind === "pay" ? "ok" : "info"}>
                  {t(`records.${r.kind}`)}
                </StatusPill>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-3 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">{t("home.upcoming")}</h2>
          </div>
          <Link to="/calendar" className="text-xs font-bold text-primary">
            {t("home.openCalendar")}
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {upcoming.length === 0 ? (
            <li className="text-xs text-muted-foreground">{t("home.noEvents")}</li>
          ) : (
            upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-bold text-muted-foreground">
                  {formatKDate(e.date).slice(5)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {e.title}
                </span>
                <StatusPill tone={e.category === "급여" ? "ok" : "info"}>{e.category}</StatusPill>
              </li>
            ))
          )}
        </ul>
      </section>

      {state.payRecords.length === 0 ? (
        <Button variant="secondary" className="mt-4 w-full" onClick={loadSample}>
          <Sparkles className="size-4" /> {t("home.trySampleFull")}
        </Button>
      ) : null}
    </AppShell>
  );
}

