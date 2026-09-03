"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  ExternalLink,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { usePayCycle } from "@/state/paycycle-context";
import { useT } from "@/i18n";
import { formatKDate, won } from "@/lib/paycycle/format";
import { evaluateTax } from "@/lib/paycycle/rule-engine";
import { saveTaxCheckResult } from "@/lib/paycycle/result-storage";
import type { TaxCard, TaxProfile } from "@/lib/paycycle/types";
import { cn } from "@/lib/utils";

const STEP_TOTAL = 4;

export default function TaxCheckPage() {
  const { state, hydrated, yearlyPay, monthsRecorded, updateTaxProfile, signature } = usePayCycle();
  const { t } = useT();

  const [step, setStep] = useState(-1);
  const [localTaxProfile, setLocalTaxProfile] = useState<TaxProfile>(() => ({
    housingSaving: state.taxProfile?.housingSaving ?? null,
    housingSavingProof: state.taxProfile?.housingSavingProof ?? null,
    isHomeless: state.taxProfile?.isHomeless ?? null,
    usesDeductions: state.taxProfile?.usesDeductions ?? null,
  }));

  // Context의 taxProfile이 hydration된 이후에만 localTaxProfile과 동기화
  useEffect(() => {
    if (hydrated && state.taxProfile) {
      setLocalTaxProfile({
        housingSaving: state.taxProfile.housingSaving ?? null,
        housingSavingProof: state.taxProfile.housingSavingProof ?? null,
        isHomeless: state.taxProfile.isHomeless ?? null,
        usesDeductions: state.taxProfile.usesDeductions ?? null,
      });
    }
  }, [hydrated, state.taxProfile]);

  const handleUpdateTaxProfile = (patch: Partial<TaxProfile>) => {
    setLocalTaxProfile((prev) => {
      const next = { ...prev, ...patch };
      if (hydrated) {
        updateTaxProfile(next);
      }
      return next;
    });
  };

  const savedFingerprint = useRef<string | null>(null);

  const employment = state.employment;
  const currentYear = new Date().getFullYear();

  // 실제 데이터 연동 (기본값 제거)
  const effectiveYearlyPay = yearlyPay > 0 ? yearlyPay : 0;
  const effectiveMonths = monthsRecorded > 0 ? monthsRecorded : 0;

  const cards: TaxCard[] = useMemo(() => {
    return evaluateTax({
      employment,
      yearlyPay: effectiveYearlyPay,
      monthsRecorded: effectiveMonths,
      taxProfile: localTaxProfile,
    });
  }, [employment, effectiveYearlyPay, effectiveMonths, localTaxProfile]);

  const applicableCount = cards.filter((c) => c.status === "적용 가능성 있음").length;
  const needCount = cards.filter((c) => c.status === "추가 자료 필요").length;

  const canGoNext = useMemo(() => {
    if (step === 1) {
      const housingAnswered = localTaxProfile.housingSaving !== null;
      const homelessAnswered = localTaxProfile.isHomeless !== null;
      const proofAnswered =
        localTaxProfile.housingSaving === false ||
        localTaxProfile.housingSavingProof !== null;
      return housingAnswered && homelessAnswered && proofAnswered;
    }
    if (step === 2) return localTaxProfile.usesDeductions !== null;
    return true;
  }, [step, localTaxProfile]);

  // 결과 화면 도달 시 저장
  useEffect(() => {
    if (step === 3 && hydrated) {
      const fingerprint = JSON.stringify({
        year: currentYear,
        yearlyPay: effectiveYearlyPay,
        monthsRecorded: effectiveMonths,
        localTaxProfile,
        signature,
      });

      if (savedFingerprint.current === fingerprint) return;

      const res = saveTaxCheckResult({
        profileSignature: signature,
        year: currentYear,
        yearlyPay: effectiveYearlyPay,
        monthsRecorded: effectiveMonths,
        taxProfile: localTaxProfile,
        cards: cards.map((c) => ({
          id: c.id as any,
          title: c.title,
          status: c.status as any,
          tone: c.status === "적용 가능성 있음" ? "possible" : c.status === "추가 자료 필요" ? "need" : "not",
          summary: c.summary,
          confirmed: c.confirmed,
          missing: c.missing,
          nextActions: c.nextActions,
          evidence: c.evidence,
        })),
      });

      if (res) {
        savedFingerprint.current = fingerprint;
        updateTaxProfile(localTaxProfile);
        toast.success(t("tax.saved"));
      }
    }
  }, [
    step,
    currentYear,
    effectiveYearlyPay,
    effectiveMonths,
    localTaxProfile,
    cards,
    updateTaxProfile,
    signature,
    hydrated,
    t,
  ]);

  const handleCopyResult = () => {
    const text = cards
      .map(
        (c) =>
          `[${c.title}] - ${c.status}\n` +
          `• 요약: ${c.summary}\n` +
          `• 다음 행동: ${c.nextActions.join(", ") || "없음"}`
      )
      .join("\n\n");

    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t("common.copied")))
      .catch(() => toast.error(t("common.copyFailed")));
  };

  if (!hydrated) {
    return (
      <AppShell title={t("tab.tax")}>
        <div className="py-20 text-center text-sm text-muted-foreground">
          {t("home.loading")}
        </div>
      </AppShell>
    );
  }

  // 1. 시작 화면
  if (step === -1) {
    return (
      <AppShell title={t("tab.tax")} subtitle={t("tax.step.startDesc")}>
        <div className="space-y-4">
          {/* 상단 배너 카드 */}
          <div className="rounded-3xl bg-gradient-to-br from-primary via-[#1D4A88] to-primary p-6 text-primary-foreground shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
              <Receipt className="size-4" />
              <span>{t("landing.f2.when")}</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {t("tax.step.start")}
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              {t("tax.step.startDesc")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-white/10 text-xs">
              <span className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
                {t("tax.step.yearlyRecorded", { amount: won(effectiveYearlyPay) })}
              </span>
              <span className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
                {t("tax.step.monthsRecorded", { n: effectiveMonths })}
              </span>
            </div>
          </div>

          {/* 주요 확인 항목 */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground">
              {t("landing.f2.text")}
            </h3>
            <div className="grid gap-2.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <strong className="font-semibold text-foreground">{t("tax.step1.title")}</strong>
                  <p className="mt-0.5">{t("tax.step1.desc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Wallet className="size-4 shrink-0 text-info mt-0.5" />
                <div>
                  <strong className="font-semibold text-foreground">{t("tax.step2.title")}</strong>
                  <p className="mt-0.5">{t("tax.step2.desc")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Receipt className="size-4 shrink-0 text-signal mt-0.5" />
                <div>
                  <strong className="font-semibold text-foreground">{t("tax.step3.title")}</strong>
                  <p className="mt-0.5">{t("tax.step3.desc")}</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setStep(0)}
            size="lg"
            className="w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/25"
          >
            {t("common.start")}
            <ArrowRight className="ml-2 size-5" />
          </Button>
        </div>
      </AppShell>
    );
  }

  // 2. 단계별 마법사
  return (
    <AppShell title={t("tab.tax")}>
      <div className="space-y-5">
        {/* 진행 바 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("common.step")} {step + 1} / {STEP_TOTAL}
            </span>
            <span className="font-semibold text-primary">
              {step === 0 && t("tax.step.step0")}
              {step === 1 && t("tax.step.step1")}
              {step === 2 && t("tax.step.step2")}
              {step === 3 && t("tax.step.step3")}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / STEP_TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* 0단계: 기본 체류 및 거주자 요건 확인 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground">
                {t("tax.step0.header")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("tax.step0.desc")}
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">{t("tax.step0.entryDate")}</span>
                  <span className="font-bold text-foreground">
                    {employment?.entryDate?.value ? formatKDate(employment.entryDate.value) : t("common.unknown")}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">{t("tax.step0.yearlyPay", { n: effectiveMonths })}</span>
                  <span className="font-bold text-foreground">
                    {won(effectiveYearlyPay)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                  <span className="font-semibold">{t("tax.step0.residentStatus")}</span>
                  <span className="font-extrabold">
                    {cards.find((c) => c.id === "resident")?.status || t("tax.step0.evaluating")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1단계: 주택청약저축 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground">
                {t("tax.step1.header")}
              </h2>

              {/* Q1: 가입 여부 */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-bold text-foreground">
                  {t("tax.step1.q1")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("tax.q.housingHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={localTaxProfile.housingSaving === true ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => handleUpdateTaxProfile({ housingSaving: true })}
                  >
                    {t("tax.step1.q1Yes")}
                  </Button>
                  <Button
                    type="button"
                    variant={localTaxProfile.housingSaving === false ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => handleUpdateTaxProfile({ housingSaving: false, housingSavingProof: false })}
                  >
                    {t("tax.step1.q1No")}
                  </Button>
                </div>
              </div>

              {/* Q2: 무주택 세대주 */}
              <div className="space-y-2 pt-3 border-t border-border/60">
                <p className="text-xs font-bold text-foreground">
                  {t("tax.step1.q2")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("tax.q.homelessHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={localTaxProfile.isHomeless === true ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => handleUpdateTaxProfile({ isHomeless: true })}
                  >
                    {t("tax.step1.q2Yes")}
                  </Button>
                  <Button
                    type="button"
                    variant={localTaxProfile.isHomeless === false ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => handleUpdateTaxProfile({ isHomeless: false })}
                  >
                    {t("tax.step1.q2No")}
                  </Button>
                </div>
              </div>

              {/* Q3: 납입증명서 발급 */}
              {localTaxProfile.housingSaving === true && (
                <div className="space-y-2 pt-3 border-t border-border/60">
                  <p className="text-xs font-bold text-foreground">
                    {t("tax.step1.q3")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("tax.q.proofHint")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant={localTaxProfile.housingSavingProof === true ? "default" : "outline"}
                      className="rounded-xl text-xs font-semibold"
                      onClick={() => handleUpdateTaxProfile({ housingSavingProof: true })}
                    >
                      {t("tax.step1.q3Yes")}
                    </Button>
                    <Button
                      type="button"
                      variant={localTaxProfile.housingSavingProof === false ? "default" : "outline"}
                      className="rounded-xl text-xs font-semibold"
                      onClick={() => handleUpdateTaxProfile({ housingSavingProof: false })}
                    >
                      {t("tax.step1.q3No")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2단계: 19% 단일세율 vs 소득공제 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground">
                {t("tax.step2.header")}
              </h2>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-bold text-foreground">
                  {t("tax.step2.q1")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("tax.q.deductHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant={localTaxProfile.usesDeductions === true ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => handleUpdateTaxProfile({ usesDeductions: true })}
                  >
                    {t("tax.step2.q1Yes")}
                  </Button>
                  <Button
                    type="button"
                    variant={localTaxProfile.usesDeductions === false ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => handleUpdateTaxProfile({ usesDeductions: false })}
                  >
                    {t("tax.step2.q1No")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3단계: 최종 결과 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-card border border-border/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">
                  {t("tax.resultHeading")}
                </h2>
                <span className="rounded-xl bg-signal/15 px-2.5 py-1 text-xs font-bold text-signal">
                  {t("tax.okCount", { n: applicableCount })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("tax.resultLead")}
              </p>
            </div>

            {/* 카드 목록 */}
            <div className="space-y-3">
              {cards.map((card) => {
                const isOk = card.status === "적용 가능성 있음";
                return (
                  <div
                    key={card.id}
                    className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          {card.title}
                        </h3>
                        <span
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 text-xs font-semibold",
                            isOk ? "text-signal" : "text-warn"
                          )}
                        >
                          {isOk ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                          {card.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {card.summary}
                    </p>

                    {/* 확인된 사실 */}
                    {card.confirmed.length > 0 && (
                      <div className="rounded-2xl bg-muted/40 p-3 text-xs space-y-1">
                        <span className="font-semibold text-foreground">확인 정보:</span>
                        {card.confirmed.map((item, idx) => (
                          <p key={idx} className="text-muted-foreground">
                            • {item}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* 다음 행동 */}
                    {card.nextActions.length > 0 && (
                      <div className="rounded-2xl bg-primary/5 p-3 text-xs space-y-1 border border-primary/15">
                        <span className="font-bold text-primary">
                          {t("tax.actionTitle")}:
                        </span>
                        {card.nextActions.map((action, idx) => (
                          <p key={idx} className="text-foreground font-medium">
                            • {action}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* 법령 근거 */}
                    {card.evidence && card.evidence.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-2 text-xs">
                        {card.evidence.map((ev, idx) => (
                          <a
                            key={idx}
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="size-3" />
                            {ev.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 하단 액션 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCopyResult}
                className="flex-1 rounded-2xl text-xs font-semibold"
              >
                <Clipboard className="mr-1.5 size-4" />
                {t("tax.copy")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  savedFingerprint.current = null;
                  setStep(0);
                }}
                className="rounded-2xl text-xs font-semibold"
              >
                <RotateCcw className="mr-1.5 size-4" />
                {t("common.again")}
              </Button>
            </div>
          </div>
        )}

        {/* 내비게이션 버튼 */}
        {step < 3 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-2xl text-xs font-semibold"
            >
              <ArrowLeft className="mr-1.5 size-4" />
              {t("common.prev")}
            </Button>
            <Button
              type="button"
              disabled={!canGoNext}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-2xl text-xs font-bold"
            >
              {t("common.next")}
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
