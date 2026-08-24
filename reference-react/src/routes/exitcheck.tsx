import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { DateField } from "@/components/date-field";
import { LevelCard, WizardStart, WizardStep } from "@/components/wizard";
import { usePayCycle } from "@/state/paycycle-context";
import { RULE_LEVEL, RULE_TONE } from "@/routes/taxcheck";
import { dDay, evaluateExit, exitRoadmap, monthsWorked, ruleStatusLabel } from "@/lib/paycycle/rule-engine";
import { formatKDate, isoDate } from "@/lib/paycycle/format";
import { useT } from "@/i18n";
import type { ExitClaim, ExitProfile } from "@/lib/paycycle/types";

export const Route = createFileRoute("/exitcheck")({
  head: () => ({
    meta: [
      { title: "ExitCheck · 출국 전 정산 확인" },
      {
        name: "description",
        content:
          "출국만기보험금, 귀국비용보험금, 국민연금 반환일시금, 퇴직금 차액의 조건과 필요한 서류를 단계별로 확인합니다.",
      },
      { property: "og:title", content: "ExitCheck · 출국 전 정산 확인" },
      {
        property: "og:description",
        content: "출국 전에 확인해야 할 정산 항목과 서류를 순서대로 안내합니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExitCheck,
});

const STEP_TOTAL = 6;

function ExitCheck() {
  const { state, saveProfile, updateExitProfile, saveResult } = usePayCycle();
  const { t } = useT();
  const [step, setStep] = useState(-1);
  const savedRef = useRef(false);

  const employment = state.employment;
  const exit = employment?.exitDate;
  const exitIso = exit && !exit.unknown && exit.value ? exit.value : null;
  const totalMonths = monthsWorked(employment);

  const claims = useMemo(
    () =>
      evaluateExit({
        employment,
        exitProfile: state.exitProfile,
        totalMonths,
      }),
    [employment, state.exitProfile, totalMonths],
  );

  const roadmap = exitIso ? exitRoadmap(exitIso) : [];
  const today = isoDate(new Date());
  const readyCount = claims.filter((c) => c.status === "적용 가능성 있음").length;

  /* 마지막 요약 단계에 도달하면 결과를 한 번만 저장한다. */
  useEffect(() => {
    if (step !== STEP_TOTAL - 1 || savedRef.current) return;
    savedRef.current = true;
    void saveResult({
      kind: "exit",
      departureDate: exitIso,
      readyCount,
      totalCount: claims.length,
      exitProfile: state.exitProfile,
      employment,
    }).then(() => toast.success(t("records.saveDone")));
  }, [step, saveResult, exitIso, readyCount, claims.length, state.exitProfile, employment, t]);


  /** 출국일을 바꾸면 프로필·캘린더·준비 항목이 즉시 다시 계산된다. */
  const setExitDate = (value: { value: string; unknown: boolean }) => {
    if (!state.profile || !employment) return;
    saveProfile(state.profile, { ...employment, exitDate: value });
    toast.success(t("exit.recalc"));
  };

  if (step < 0) {
    return (
      <AppShell title={t("exit.title")} subtitle={t("exit.subtitle")}>
        <WizardStart
          icon={<Plane className="size-7" />}
          title={t("exit.startTitle")}
          description={t("exit.startDesc")}
          cta={t("exit.startCta")}
          onStart={() => setStep(0)}
        />
      </AppShell>
    );
  }

  const question = (key: keyof ExitProfile, label: string) => (
    <div key={key} className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-[15px] font-semibold text-foreground">{label}</p>
      <div className="mt-3 flex gap-2">
        {[
          { label: "예", value: true },
          { label: "아니오", value: false },
        ].map((option) => {
          const active = state.exitProfile[key] === option.value;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => updateExitProfile({ [key]: option.value } as Partial<ExitProfile>)}
              className={`flex-1 rounded-xl border py-3 text-sm font-semibold ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const titles = [
    t("exit.s1"),
    t("exit.s2"),
    t("exit.s3"),
    t("exit.s4"),
    t("exit.s5"),
    t("exit.s6"),
  ];

  return (
    <AppShell title={t("exit.title")} subtitle={t("exit.subtitle")}>
      <WizardStep
        index={step}
        total={STEP_TOTAL}
        title={titles[step] ?? ""}
        onPrev={() => setStep(step === 0 ? -1 : step - 1)}
        onNext={step === STEP_TOTAL - 1 ? undefined : () => setStep(step + 1)}
      >
        {step === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm">
              {exitIso ? (
                <>
                  <p className="text-xs font-semibold opacity-80">{t("exit.dday")}</p>
                  <p className="mt-1 text-3xl font-bold">D-{dDay(exitIso)}</p>
                  <p className="mt-1 text-xs opacity-80">{formatKDate(exitIso)}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold">{t("exit.noExitDate")}</p>
                  <p className="mt-1 text-xs opacity-80">{t("exit.setExitDate")}</p>
                </>
              )}
            </div>
            {employment && state.profile ? (
              <DateField
                label={t("exit.dday")}
                value={exit ?? { value: "", unknown: false }}
                onChange={setExitDate}
                rule={{ noPast: true }}
              />
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <LevelCard level={totalMonths === null ? "warn" : "info"}>
              <p className="text-xs font-bold text-muted-foreground">{t("exit.months")}</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {totalMonths === null ? t("exit.monthsUnknown") : `약 ${totalMonths}개월`}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                계속근로 1년 이상이면 퇴직금 대상 여부를 확인할 수 있습니다.
              </p>
            </LevelCard>
            <ClaimView claim={claims.find((c) => c.id === "severance")} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {question("hasInsuranceRecord", "출국만기보험 가입 사실을 확인했나요?")}
            {question("pensionDeducted", "임금명세서에 국민연금 공제가 있나요?")}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            {question("hasExitProof", "출국 예정 증빙(항공권 등)이 있나요?")}
            {question("hasRecentPayslip", "최근 3개월 급여명세서를 가지고 있나요?")}
            {question("hasOwnAccount", "본인 명의 계좌를 가지고 있나요?")}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            {roadmap.length ? (
              <section className="rounded-2xl bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-foreground">{t("exit.roadmap")}</h3>
                <ol className="mt-3 space-y-3">
                  {roadmap.map((s) => {
                    const passed = s.date <= today;
                    return (
                      <li key={s.label} className="flex gap-3">
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${
                            passed ? "bg-signal" : "bg-border"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-bold text-foreground">{s.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatKDate(s.date)} · {s.detail}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  위 날짜는 공식 기한이 아니라 서비스가 제안하는 권장 준비일입니다.
                </p>
              </section>
            ) : (
              <LevelCard level="warn">
                <p className="text-sm font-semibold text-foreground">{t("exit.noExitDate")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("exit.setExitDate")}</p>
              </LevelCard>
            )}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            {claims.map((c) => (
              <ClaimView key={c.id} claim={c} />
            ))}
            <p className="pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              {t("exit.footer")}
            </p>
          </div>
        ) : null}
      </WizardStep>
    </AppShell>
  );
}

function ClaimView({ claim }: { claim: ExitClaim | undefined }) {
  const { t } = useT();
  if (!claim) return null;

  return (
    <LevelCard level={RULE_LEVEL[claim.status]}>
      <StatusPill tone={RULE_TONE[claim.status]}>{ruleStatusLabel(claim.status)}</StatusPill>
      <h3 className="mt-2.5 text-base font-bold text-foreground">{claim.title}</h3>

      <div className="mt-3 rounded-xl bg-card/70 p-3">
        <p className="text-[11px] font-bold text-muted-foreground">{t("tax.confirmedInfo")}</p>
        <ul className="mt-1 space-y-0.5">
          {claim.confirmed.map((c) => (
            <li key={c} className="text-xs text-foreground">
              · {c}
            </li>
          ))}
        </ul>
      </div>

      {claim.missing.length ? (
        <p className="mt-2 text-xs text-warn-foreground">
          {t("tax.missing")}: {claim.missing.join(", ")}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        {t("exit.docs")}: {claim.documents.join(", ")}
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">→ {claim.nextAction}</p>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-border/60 pt-2.5">
        {claim.evidence.map((e) => (
          <a
            key={e.url}
            href={e.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-primary underline underline-offset-4"
          >
            {e.title}
          </a>
        ))}
      </div>
    </LevelCard>
  );
}
