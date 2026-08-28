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
  const { state, hydrated, yearlyPay, monthsRecorded, updateTaxProfile } = usePayCycle();
  const { t } = useT();

  const [step, setStep] = useState(-1);
  const [localTaxProfile, setLocalTaxProfile] = useState<TaxProfile>(() => ({
    housingSaving: state.taxProfile?.housingSaving ?? null,
    housingSavingProof: state.taxProfile?.housingSavingProof ?? null,
    isHomeless: state.taxProfile?.isHomeless ?? null,
    usesDeductions: state.taxProfile?.usesDeductions ?? null,
  }));

  const savedFingerprint = useRef<string | null>(null);

  const employment = state.employment;
  const currentYear = new Date().getFullYear();

  // 실제 데이터 또는 기본값 연동
  const effectiveYearlyPay = yearlyPay > 0 ? yearlyPay : 28560000;
  const effectiveMonths = monthsRecorded > 0 ? monthsRecorded : 12;

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
    if (step === 3) {
      const fingerprint = JSON.stringify({
        year: currentYear,
        yearlyPay: effectiveYearlyPay,
        monthsRecorded: effectiveMonths,
        localTaxProfile,
      });

      if (savedFingerprint.current === fingerprint) return;
      savedFingerprint.current = fingerprint;

      saveTaxCheckResult({
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

      updateTaxProfile(localTaxProfile);
      toast.success(t("tax.copied"));
    }
  }, [step, currentYear, effectiveYearlyPay, effectiveMonths, localTaxProfile, cards, updateTaxProfile, t]);

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
      <AppShell title={t("tab.tax")} subtitle="외국인 근로자 연말정산 및 세액공제 혜택을 확인해요">
        <div className="space-y-4">
          {/* 상단 배너 카드 */}
          <div className="rounded-3xl bg-gradient-to-br from-primary via-[#1D4A88] to-primary p-6 text-primary-foreground shadow-xl shadow-primary/20">
            <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
              <Receipt className="size-4" />
              <span>{t("landing.f2.when")}</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              연말정산 & 세금 혜택 점검
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              거주자 판정부터 주택청약저축 공제, 19% 단일세율 유불리까지 4단계로 점검합니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-white/10 text-xs">
              <span className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
                올해 확인 급여: {won(effectiveYearlyPay)}
              </span>
              <span className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
                기록 개월: {effectiveMonths}개월
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
                  <strong className="font-semibold text-foreground">1. 세법상 거주자 판정 (183일 기준)</strong>
                  <p className="mt-0.5">국내 체류 기간에 따라 내국인과 동일한 소득공제 적용 여부 판정</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Wallet className="size-4 shrink-0 text-info mt-0.5" />
                <div>
                  <strong className="font-semibold text-foreground">2. 주택청약종합저축 소득공제</strong>
                  <p className="mt-0.5">무주택 세대주 외국인 근로자의 청약저축 납입액 40% 공제 확인</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Receipt className="size-4 shrink-0 text-signal mt-0.5" />
                <div>
                  <strong className="font-semibold text-foreground">3. 19% 단일세율 vs 종합과세 비교</strong>
                  <p className="mt-0.5">공제 항목 유무에 따라 19% 단일세율 특례 적용이 유리한지 비교</p>
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
              {step === 0 && "1. 현재 정보 확인"}
              {step === 1 && "2. 주택청약저축 확인"}
              {step === 2 && "3. 세율 선택 확인"}
              {step === 3 && "4. 최종 확인 결과"}
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
                현재 체류 및 소득 정보
              </h2>
              <p className="text-xs text-muted-foreground">
                프로필 및 급여 기록을 토대로 세법상 거주자 요건을 자동 계산합니다.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">입국일</span>
                  <span className="font-bold text-foreground">
                    {employment?.entryDate?.value ? formatKDate(employment.entryDate.value) : t("common.unknown")}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">올해 누적 급여 ({effectiveMonths}개월)</span>
                  <span className="font-bold text-foreground">
                    {won(effectiveYearlyPay)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                  <span className="font-semibold">거주자 판정 상태</span>
                  <span className="font-extrabold">
                    {cards.find((c) => c.id === "resident")?.status || "판정 중"}
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
                주택청약종합저축 소득공제 확인
              </h2>

              {/* Q1: 가입 여부 */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-bold text-foreground">
                  1. {t("tax.q.housing")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("tax.q.housingHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={localTaxProfile.housingSaving === true ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => setLocalTaxProfile((p) => ({ ...p, housingSaving: true }))}
                  >
                    가입함
                  </Button>
                  <Button
                    type="button"
                    variant={localTaxProfile.housingSaving === false ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => setLocalTaxProfile((p) => ({ ...p, housingSaving: false, housingSavingProof: false }))}
                  >
                    가입 안 함
                  </Button>
                </div>
              </div>

              {/* Q2: 무주택 세대주 */}
              <div className="space-y-2 pt-3 border-t border-border/60">
                <p className="text-xs font-bold text-foreground">
                  2. {t("tax.q.homeless")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("tax.q.homelessHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={localTaxProfile.isHomeless === true ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => setLocalTaxProfile((p) => ({ ...p, isHomeless: true }))}
                  >
                    본인 명의 주택 없음
                  </Button>
                  <Button
                    type="button"
                    variant={localTaxProfile.isHomeless === false ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => setLocalTaxProfile((p) => ({ ...p, isHomeless: false }))}
                  >
                    주택 보유
                  </Button>
                </div>
              </div>

              {/* Q3: 납입증명서 발급 */}
              {localTaxProfile.housingSaving === true && (
                <div className="space-y-2 pt-3 border-t border-border/60">
                  <p className="text-xs font-bold text-foreground">
                    3. {t("tax.q.proof")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("tax.q.proofHint")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant={localTaxProfile.housingSavingProof === true ? "default" : "outline"}
                      className="rounded-xl text-xs font-semibold"
                      onClick={() => setLocalTaxProfile((p) => ({ ...p, housingSavingProof: true }))}
                    >
                      발급 가능
                    </Button>
                    <Button
                      type="button"
                      variant={localTaxProfile.housingSavingProof === false ? "default" : "outline"}
                      className="rounded-xl text-xs font-semibold"
                      onClick={() => setLocalTaxProfile((p) => ({ ...p, housingSavingProof: false }))}
                    >
                      발급 불가 / 모름
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
                세율 적용 방식 확인
              </h2>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-bold text-foreground">
                  {t("tax.q.deduct")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("tax.q.deductHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant={localTaxProfile.usesDeductions === true ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => setLocalTaxProfile((p) => ({ ...p, usesDeductions: true }))}
                  >
                    소득공제 활용 (종합과세)
                  </Button>
                  <Button
                    type="button"
                    variant={localTaxProfile.usesDeductions === false ? "default" : "outline"}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => setLocalTaxProfile((p) => ({ ...p, usesDeductions: false }))}
                  >
                    19% 단일세율 검토
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
