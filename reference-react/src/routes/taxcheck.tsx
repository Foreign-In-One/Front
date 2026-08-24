import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { LevelCard, WizardStart, WizardStep, type Level } from "@/components/wizard";
import { usePayCycle } from "@/state/paycycle-context";
import { evaluateTax, daysInKoreaThisYear, ruleStatusLabel } from "@/lib/paycycle/rule-engine";
import { won } from "@/lib/paycycle/format";
import { useT } from "@/i18n";
import type { RuleStatus, TaxCard, TaxProfile } from "@/lib/paycycle/types";

export const Route = createFileRoute("/taxcheck")({
  head: () => ({
    meta: [
      { title: "TaxCheck · 연말정산 확인 항목" },
      {
        name: "description",
        content:
          "저장된 급여 기록과 입국일을 기준으로 거주자 여부, 주택청약저축 소득공제, 19% 단일세율 특례 조건을 단계별로 확인합니다.",
      },
      { property: "og:title", content: "TaxCheck · 연말정산 확인 항목" },
      {
        property: "og:description",
        content: "내 데이터로 연말정산에서 확인할 항목과 필요한 서류를 정리합니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaxCheck,
});

export const RULE_TONE: Record<RuleStatus | "대상 후보", "ok" | "warn" | "info" | "neutral"> = {
  "적용 가능성 있음": "ok",
  "조건 미충족": "neutral",
  "추가 자료 필요": "warn",
  "현재 정보로 판단 불가": "neutral",
  "대상 후보": "info",
};

/** 중요도 색상 규칙과 판정 상태를 하나로 연결한다. */
export const RULE_LEVEL: Record<RuleStatus | "대상 후보", Level> = {
  "적용 가능성 있음": "ok",
  "조건 미충족": "info",
  "추가 자료 필요": "warn",
  "현재 정보로 판단 불가": "info",
  "대상 후보": "info",
};

const STEP_TOTAL = 4;

function TaxCheck() {
  const { state, yearlyPay, monthsRecorded, updateTaxProfile, saveResult } = usePayCycle();
  const { t } = useT();
  const [step, setStep] = useState(-1);
  const savedRef = useRef(false);

  const cards = useMemo(
    () =>
      evaluateTax({
        employment: state.employment,
        yearlyPay,
        monthsRecorded,
        taxProfile: state.taxProfile,
      }),
    [state.employment, state.taxProfile, yearlyPay, monthsRecorded],
  );

  const needsAction = cards.filter((c) => c.status === "추가 자료 필요").length;
  const applicable = cards.filter((c) => c.status === "적용 가능성 있음").length;

  /* 결과 화면에 도달하면 한 번만 저장한다. */
  useEffect(() => {
    if (step !== STEP_TOTAL - 1 || savedRef.current) return;
    savedRef.current = true;
    void saveResult({
      kind: "tax",
      year: new Date().getFullYear(),
      yearlyPay,
      monthsRecorded,
      needsActionCount: needsAction,
      applicableCount: applicable,
      totalCount: cards.length,
      taxProfile: state.taxProfile,
      employment: state.employment,
    }).then(() => toast.success(t("records.saveDone")));
  }, [
    step,
    saveResult,
    yearlyPay,
    monthsRecorded,
    needsAction,
    applicable,
    cards.length,
    state.taxProfile,
    state.employment,
    t,
  ]);

  const days = daysInKoreaThisYear(state.employment);
  const card = (id: string) => cards.find((c) => c.id === id);

  const back = () => setStep((s) => s - 1);
  const next = () => setStep((s) => s + 1);

  if (step < 0) {
    return (
      <AppShell title={t("tax.title")} subtitle={t("tax.subtitle")}>
        <WizardStart
          icon={<Receipt className="size-7" />}
          title={t("tax.startTitle")}
          description={t("tax.startDesc")}
          cta={t("tax.startCta")}
          onStart={() => setStep(0)}
        />
      </AppShell>
    );
  }

  const question = (key: keyof TaxProfile, label: string, hint?: string) => (
    <div key={key} className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-[15px] font-semibold text-foreground">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 flex gap-2">
        {[
          { label: t("tax.yes"), value: true },
          { label: t("tax.no"), value: false },
        ].map((option) => {
          const active = state.taxProfile[key] === option.value;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => updateTaxProfile({ [key]: option.value } as Partial<TaxProfile>)}
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

  const titles = [t("tax.s1"), t("tax.s2"), t("tax.s3"), t("tax.resultHeading")];

  return (
    <AppShell title={t("tax.title")} subtitle={t("tax.subtitle")}>
      <WizardStep
        index={step}
        total={STEP_TOTAL}
        title={titles[step] ?? ""}
        onPrev={() => (step === 0 ? setStep(-1) : back())}
        onNext={step === STEP_TOTAL - 1 ? undefined : next}
      >
        {step === 0 ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm">
              <p className="text-xs font-semibold opacity-80">{t("tax.yearlyPay")}</p>
              <p className="mt-1 text-2xl font-bold">{won(yearlyPay)}</p>
              <p className="mt-1 text-xs opacity-80">
                {t("tax.months", { n: monthsRecorded })} · {t("tax.days")}{" "}
                {days === null ? t("tax.daysUnknown") : t("tax.daysApprox", { n: days })}
              </p>
            </div>
            <TaxCardView card={card("resident")} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            {question("housingSaving", t("tax.q.housing"), t("tax.q.housingHint"))}
            {state.taxProfile.housingSaving === true
              ? question("housingSavingProof", t("tax.q.proof"), t("tax.q.proofHint"))
              : null}
            {question("isHomeless", t("tax.q.homeless"), t("tax.q.homelessHint"))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {question("usesDeductions", t("tax.q.deduct"), t("tax.q.deductHint"))}
            <TaxCardView card={card("flat")} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("tax.resultLead")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="ok">{t("tax.okCount", { n: applicable })}</StatusPill>
                <StatusPill tone={needsAction ? "warn" : "neutral"}>
                  {t("tax.needCount", { n: needsAction })}
                </StatusPill>
              </div>
            </div>

            {cards.map((c) => (
              <TaxCardView key={c.id} card={c} />
            ))}

            <p className="pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              {t("tax.footer")}
            </p>
          </div>
        ) : null}
      </WizardStep>
    </AppShell>
  );
}

/** 판단 결과 · 이유 · 근거 · 다음 행동을 한 카드 안에 담는다. */
function TaxCardView({ card }: { card: TaxCard | undefined }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!card) return null;

  const copyText = [
    card.title,
    card.summary,
    ...card.nextActions.map((n) => `- ${n}`),
  ].join("\n");

  return (
    <LevelCard level={RULE_LEVEL[card.status]}>
      <StatusPill tone={RULE_TONE[card.status]}>{ruleStatusLabel(card.status)}</StatusPill>
      <h3 className="mt-2.5 text-base font-bold text-foreground">{card.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.summary}</p>

      {card.nextActions.length ? (
        <div className="mt-3 rounded-xl bg-primary/8 p-3">
          <p className="text-[11px] font-bold text-primary">{t("tax.actionTitle")}</p>
          <ol className="mt-1.5 space-y-1.5">
            {card.nextActions.map((n, i) => (
              <li key={n} className="flex gap-2 text-[13px] font-semibold leading-relaxed text-foreground">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {n}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("tax.actionEmpty")}</p>
      )}

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-bold text-primary underline underline-offset-4"
        >
          {t("tax.why")}
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(copyText);
            toast.success(t("tax.copied"));
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <Copy className="size-3.5" /> {t("tax.copy")}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">{t("tax.reason")}</p>
            <ul className="mt-1 space-y-0.5">
              {card.confirmed.map((c) => (
                <li key={c} className="text-xs text-foreground">
                  · {c}
                </li>
              ))}
            </ul>
          </div>
          {card.missing.length ? (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground">{t("tax.missing")}</p>
              <p className="mt-1 text-xs text-warn-foreground">{card.missing.join(", ")}</p>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">{t("tax.basis")}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {card.evidence.map((e) => (
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
          </div>
        </div>
      ) : null}
    </LevelCard>
  );
}

