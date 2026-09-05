'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  History,
  Plane,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WizardStart } from '@/components/wizard';
import { useT } from '@/i18n';
import { formatKDate } from '@/lib/paycycle/format';
import {
  listSavedResults,
  type SavedResult,
  saveExitCheckResult,
} from '@/lib/paycycle/result-storage';
import { evaluateExit } from '@/lib/paycycle/rule-engine';
import type { ExitClaim, ExitProfile } from '@/lib/paycycle/types';
import { usePayCycle } from '@/state/paycycle-context';

const STEP_TOTAL = 4;

export default function ExitCheckPage() {
  const { state, hydrated, updateExitProfile, signature } = usePayCycle();
  const { t } = useT();

  const [step, setStep] = useState(-1);
  const [pastResults, setPastResults] = useState<SavedResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SavedResult | null>(
    null,
  );

  useEffect(() => {
    if (step === -1) {
      setPastResults(listSavedResults().filter((r) => r.kind === 'exit'));
    }
  }, [step]);

  const [localProfile, setLocalProfile] = useState<ExitProfile>(() => ({
    hasInsuranceRecord: state.exitProfile?.hasInsuranceRecord ?? null,
    pensionDeducted: state.exitProfile?.pensionDeducted ?? null,
    hasExitProof: state.exitProfile?.hasExitProof ?? null,
    hasRecentPayslip: state.exitProfile?.hasRecentPayslip ?? null,
    hasOwnAccount: state.exitProfile?.hasOwnAccount ?? null,
  }));

  // Context의 exitProfile이 hydration된 이후에만 localProfile과 동기화
  useEffect(() => {
    if (hydrated && state.exitProfile) {
      setLocalProfile({
        hasInsuranceRecord: state.exitProfile.hasInsuranceRecord ?? null,
        pensionDeducted: state.exitProfile.pensionDeducted ?? null,
        hasExitProof: state.exitProfile.hasExitProof ?? null,
        hasRecentPayslip: state.exitProfile.hasRecentPayslip ?? null,
        hasOwnAccount: state.exitProfile.hasOwnAccount ?? null,
      });
    }
  }, [hydrated, state.exitProfile]);

  // 프로필 옵션 변경 및 전역 state.exitProfile 실시간 동기화
  const handleUpdateExitProfile = (patch: Partial<ExitProfile>) => {
    const next = { ...localProfile, ...patch };
    setLocalProfile(next);
    if (hydrated) {
      updateExitProfile(next);
    }
  };

  const savedRef = useRef<boolean>(false);

  const employment = state.employment;
  const departureDate = employment?.exitDate?.value || null;

  // 근속 개월 수 계산 (로컬 타임존 기준 날짜 파싱)
  const totalMonths = useMemo(() => {
    if (!employment?.workStartDate?.value) return null;
    const parseLocal = (str: string) => {
      const [y, m, d] = str.split('-').map(Number);
      return y && m && d ? new Date(y, m - 1, d) : new Date(`${str}T00:00:00`);
    };
    const start = parseLocal(employment.workStartDate.value);
    const end = employment.exitDate?.value
      ? parseLocal(employment.exitDate.value)
      : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return null;
    if (end < start) return null; // 출국일이 입사일보다 빠른 경우 indeterminate

    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) {
      months -= 1;
    }
    return Math.max(0, months);
  }, [employment]);

  const claims: ExitClaim[] = useMemo(() => {
    return evaluateExit({
      employment,
      exitProfile: localProfile,
      totalMonths,
    });
  }, [employment, localProfile, totalMonths]);

  const readyCount = claims.filter(
    (c) => c.status === '적용 가능성 있음' || c.status === '대상 후보',
  ).length;

  const canGoNext = useMemo(() => {
    if (step === 1) {
      return (
        localProfile.hasInsuranceRecord !== null &&
        localProfile.hasOwnAccount !== null &&
        localProfile.hasExitProof !== null
      );
    }
    if (step === 2) {
      return localProfile.pensionDeducted !== null;
    }
    return true;
  }, [step, localProfile]);

  // 결과 화면 도달 시 자동 저장
  useEffect(() => {
    if (step === 3 && !savedRef.current && hydrated) {
      const res = saveExitCheckResult({
        profileSignature: signature,
        departureDate,
        readyCount,
        totalCount: claims.length,
        claims,
      });
      if (res) {
        savedRef.current = true;
        updateExitProfile(localProfile);
        toast.success(t('exit.saved'));
      }
    }
  }, [
    step,
    departureDate,
    readyCount,
    claims,
    localProfile,
    updateExitProfile,
    signature,
    hydrated,
    t,
  ]);

  const handleCopyResult = () => {
    const text = claims
      .map(
        (c) =>
          `[${c.title}] - ${c.status}\n` +
          `• 다음 행동: ${c.nextAction || '특이사항 없음'}\n` +
          `• 필요 서류: ${c.documents?.join(', ') || '없음'}`,
      )
      .join('\n\n');

    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t('common.copied')))
      .catch(() => toast.error(t('common.copyFailed')));
  };

  if (!hydrated) {
    return (
      <AppShell title={t('exit.title')}>
        <div className="py-20 text-center text-muted-foreground text-sm">
          {t('home.loading')}
        </div>
      </AppShell>
    );
  }

  // 1. 시작 화면
  if (step === -1) {
    return (
      <AppShell title={t('exit.title')} subtitle={t('exit.subtitle')}>
        <WizardStart
          icon={<Plane className="size-7 text-primary" />}
          title={t('exit.startTitle')}
          description={t('exit.startDesc')}
          cta={t('exit.startCta')}
          onStart={() => setStep(0)}
        />

        {/* 이전 출국 확인 내역 */}
        {pastResults.length > 0 && (
          <section className="pc-rise mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h3 className="font-bold text-foreground text-sm">
                  {t('exit.history.title')}
                </h3>
              </div>
              <Link
                href="/records"
                className="font-bold text-primary text-xs hover:underline"
              >
                {t('records.openList')}
              </Link>
            </div>

            <div className="space-y-2.5">
              {pastResults.slice(0, 3).map((r) => {
                if (r.kind !== 'exit') return null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedResult(r)}
                    className="flex w-full items-center justify-between rounded-3xl border border-border/70 bg-card p-4 text-left shadow-xs backdrop-blur-md transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                        <Plane className="size-5" />
                      </div>
                      <div>
                        <span className="font-bold text-foreground text-xs">
                          {t('records.savedAt', {
                            date: formatKDate(r.createdAt.split('T')[0]),
                          })}
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t('records.exitLine', {
                            done: r.readyCount,
                            total: r.totalCount,
                          })}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 이전 출국 확인 결과 상세 다이얼로그 */}
        <Dialog
          open={selectedResult !== null}
          onOpenChange={(open) => !open && setSelectedResult(null)}
        >
          <DialogContent className="z-[100] max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-base text-foreground">
                <Plane className="size-5 text-primary" />
                {selectedResult &&
                  t('records.savedAt', {
                    date: formatKDate(selectedResult.createdAt.split('T')[0]),
                  })}
              </DialogTitle>
            </DialogHeader>

            {selectedResult && selectedResult.kind === 'exit' && (
              <div className="space-y-3 pt-2">
                {selectedResult.claims && selectedResult.claims.length > 0 ? (
                  selectedResult.claims.map((claim) => {
                    const isReady =
                      claim.status === '적용 가능성 있음' ||
                      claim.status === '대상 후보';
                    return (
                      <div
                        key={claim.id}
                        className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm"
                      >
                        <div>
                          <h3 className="font-bold text-base text-foreground">
                            {claim.title}
                          </h3>
                          {isReady ? (
                            <span className="mt-1 inline-flex items-center gap-1 font-semibold text-signal text-xs">
                              <CheckCircle2 className="size-3.5" />
                              {claim.status}
                            </span>
                          ) : (
                            <span className="mt-1 inline-flex items-center gap-1 font-semibold text-warn text-xs">
                              <AlertTriangle className="size-3.5" />
                              {claim.status}
                            </span>
                          )}
                        </div>

                        {claim.confirmed.length > 0 && (
                          <div className="space-y-1 rounded-2xl bg-muted/40 p-3 text-xs">
                            <span className="font-semibold text-foreground">
                              확인 정보:
                            </span>
                            {claim.confirmed.map((item) => (
                              <p key={item} className="text-muted-foreground">
                                • {item}
                              </p>
                            ))}
                          </div>
                        )}

                        {claim.nextAction && (
                          <div className="space-y-1 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-xs">
                            <span className="font-bold text-primary">
                              {t('exit.nextAction')}:
                            </span>
                            <p className="font-medium text-foreground">
                              {claim.nextAction}
                            </p>
                          </div>
                        )}

                        {claim.documents && claim.documents.length > 0 && (
                          <div className="space-y-1 pt-1 text-xs">
                            <span className="font-semibold text-muted-foreground">
                              {t('exit.docsRequired')}:
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {claim.documents.map((doc) => (
                                <span
                                  key={doc}
                                  className="rounded-lg bg-secondary px-2 py-1 font-medium text-[11px] text-secondary-foreground"
                                >
                                  {doc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {t('records.exitLine', {
                      done: selectedResult.readyCount,
                      total: selectedResult.totalCount,
                    })}
                  </p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AppShell>
    );
  }

  // 2. 단계별 마법사 (0 ~ 3)
  return (
    <AppShell title={t('exit.title')}>
      <div className="space-y-5">
        {/* 진행 바 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>
              {t('common.step')} {step + 1} / {STEP_TOTAL}
            </span>
            <span className="font-semibold text-primary">
              {step === 0 && t('exit.step.info')}
              {step === 1 && t('exit.step.insurance')}
              {step === 2 && t('exit.step.pension')}
              {step === 3 && t('exit.step.result')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((step + 1) / STEP_TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* 0단계: 기본 체류 및 근무 정보 확인 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
              <h2 className="font-bold text-foreground text-xl">
                {t('exit.step0.header')}
              </h2>
              <p className="text-muted-foreground text-xs">
                {t('exit.step0.desc')}
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    {t('profile.nationality')} / {t('profile.visa')}
                  </span>
                  <span className="font-bold text-foreground">
                    {state.profile?.nationality || t('common.unknown')} ·{' '}
                    {state.profile?.visa || t('common.unknown')}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    {t('profile.workStart')}
                  </span>
                  <span className="font-bold text-foreground">
                    {employment?.workStartDate?.value
                      ? formatKDate(employment.workStartDate.value)
                      : t('common.unknown')}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    {t('profile.exitDate')}
                  </span>
                  <span className="font-bold text-foreground">
                    {departureDate
                      ? formatKDate(departureDate)
                      : t('common.unknown')}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                  <span className="font-semibold">
                    {t('exit.step0.totalWorkPeriod')}
                  </span>
                  <span className="font-bold">
                    {totalMonths !== null
                      ? t('home.monthsRecorded', { n: totalMonths })
                      : t('common.unknownValue')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1단계: 출국만기보험 & 귀국비용보험 확인 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
              <h2 className="font-bold text-foreground text-xl">
                {t('exit.step.insurance')}
              </h2>

              {/* Q1: 출국만기보험 */}
              <div className="space-y-2 border-border/60 border-t pt-2">
                <p className="font-bold text-foreground text-xs">
                  {t('exit.q1.title')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('exit.q.insuranceHint')}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={
                      localProfile.hasInsuranceRecord === true
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ hasInsuranceRecord: true })
                    }
                  >
                    {t('exit.q1.optYes')}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      localProfile.hasInsuranceRecord === false
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ hasInsuranceRecord: false })
                    }
                  >
                    {t('exit.q1.optNo')}
                  </Button>
                </div>
              </div>

              {/* Q2: 항공권 예매 여부 */}
              <div className="space-y-2 border-border/60 border-t pt-3">
                <p className="font-bold text-foreground text-xs">
                  {t('exit.q2.title')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('exit.q.ticketHint')}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={
                      localProfile.hasExitProof === true ? 'default' : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ hasExitProof: true })
                    }
                  >
                    {t('exit.q2.optYes')}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      localProfile.hasExitProof === false
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ hasExitProof: false })
                    }
                  >
                    {t('exit.q2.optNo')}
                  </Button>
                </div>
              </div>

              {/* Q3: 본인 계좌 */}
              <div className="space-y-2 border-border/60 border-t pt-3">
                <p className="font-bold text-foreground text-xs">
                  {t('exit.q3.title')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('exit.q.accountHint')}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={
                      localProfile.hasOwnAccount === true
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ hasOwnAccount: true })
                    }
                  >
                    {t('exit.q3.optYes')}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      localProfile.hasOwnAccount === false
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ hasOwnAccount: false })
                    }
                  >
                    {t('exit.q3.optNo')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2단계: 국민연금 반환일시금 확인 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
              <h2 className="font-bold text-foreground text-xl">
                {t('exit.step.pension')}
              </h2>

              <div className="space-y-2 border-border/60 border-t pt-2">
                <p className="font-bold text-foreground text-xs">
                  {t('exit.pension.qTitle')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('exit.q.pensionHint')}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant={
                      localProfile.pensionDeducted === true
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ pensionDeducted: true })
                    }
                  >
                    {t('exit.pension.optYes')}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      localProfile.pensionDeducted === false
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl font-semibold text-xs"
                    onClick={() =>
                      handleUpdateExitProfile({ pensionDeducted: false })
                    }
                  >
                    {t('exit.pension.optNo')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3단계: 최종 정산 결과 로드맵 */}
        {step === 3 && (
          <div className="space-y-4">
            {/* 결과 요약 카드 */}
            <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground text-xl">
                  {t('exit.resultHeading')}
                </h2>
                <span className="rounded-xl bg-signal/15 px-2.5 py-1 font-bold text-signal text-xs">
                  {t('exit.readyCount', { n: readyCount })}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {t('exit.resultLead')}
              </p>
            </div>

            {/* 항목별 상세 카드 */}
            <div className="space-y-3">
              {claims.map((claim) => {
                const isReady =
                  claim.status === '적용 가능성 있음' ||
                  claim.status === '대상 후보';
                return (
                  <div
                    key={claim.id}
                    className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-foreground">
                          {claim.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {isReady ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-signal">
                              <CheckCircle2 className="size-3.5" />
                              {claim.status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-warn">
                              <AlertTriangle className="size-3.5" />
                              {claim.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 확인된 사실 */}
                    {claim.confirmed.length > 0 && (
                      <div className="space-y-1 rounded-2xl bg-muted/40 p-3 text-xs">
                        <span className="font-semibold text-foreground">
                          확인 정보:
                        </span>
                        {claim.confirmed.map((item) => (
                          <p key={item} className="text-muted-foreground">
                            • {item}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* 다음 행동 */}
                    {claim.nextAction && (
                      <div className="space-y-1 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-xs">
                        <span className="font-bold text-primary">
                          {t('exit.nextAction')}:
                        </span>
                        <p className="font-medium text-foreground">
                          {claim.nextAction}
                        </p>
                      </div>
                    )}

                    {/* 필요 서류 */}
                    {claim.documents && claim.documents.length > 0 && (
                      <div className="space-y-1 pt-1 text-xs">
                        <span className="font-semibold text-muted-foreground">
                          {t('exit.docsRequired')}:
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {claim.documents.map((doc) => (
                            <span
                              key={doc}
                              className="rounded-lg bg-secondary px-2 py-1 font-medium text-[11px] text-secondary-foreground"
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 하단 액션 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCopyResult}
                className="flex-1 rounded-2xl font-semibold text-xs"
              >
                <Clipboard className="mr-1.5 size-4" />
                {t('common.copy')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  savedRef.current = false;
                  setStep(0);
                }}
                className="rounded-2xl font-semibold text-xs"
              >
                <RotateCcw className="mr-1.5 size-4" />
                {t('common.again')}
              </Button>
            </div>
          </div>
        )}

        {/* 내비게이션 버튼 (마법사 진행) */}
        {step < 3 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-2xl font-semibold text-xs"
            >
              <ArrowLeft className="mr-1.5 size-4" />
              {t('common.prev')}
            </Button>
            <Button
              type="button"
              disabled={!canGoNext}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-2xl font-bold text-xs"
            >
              {t('common.next')}
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
