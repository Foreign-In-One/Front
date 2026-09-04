'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Plane,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { formatKDate, isoDate } from '@/lib/paycycle/format';
import { saveExitCheckResult } from '@/lib/paycycle/result-storage';
import { evaluateExit } from '@/lib/paycycle/rule-engine';
import type { ExitClaim, ExitProfile } from '@/lib/paycycle/types';
import { usePayCycle } from '@/state/paycycle-context';
import { analyzeExitCheckApi } from '@/services/api';

const STEP_TOTAL = 4;

export default function ExitCheckPage() {
  const { state, hydrated, updateExitProfile, signature, addEvent, refreshFromBackend } = usePayCycle();
  const { t } = useT();

  const [step, setStep] = useState(-1);
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
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
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

  // 결과 화면 도달 시 자동 저장 및 캘린더 일정 동기화
  useEffect(() => {
    if (step === 3 && !savedRef.current && hydrated) {
      const res = saveExitCheckResult({
        profileSignature: signature,
        departureDate,
        readyCount,
        totalCount: claims.length,
      });
      if (res) {
        savedRef.current = true;
        updateExitProfile(localProfile);
        toast.success(t('exit.saved'));

        // 백엔드 ExitCheck 분석 및 저장
        void analyzeExitCheckApi({
          expectedExitDate: departureDate || undefined,
          hasInsuranceRecord: localProfile.hasInsuranceRecord,
          hasOwnAccount: localProfile.hasOwnAccount,
          hasExitProof: localProfile.hasExitProof,
          pensionDeducted: localProfile.pensionDeducted,
          hasRecentPayslip: localProfile.hasRecentPayslip,
        }).catch(() => {});

        // 출국 관련 캘린더 일정 등록
        if (departureDate) {
          // 1. 출국 D-30 퇴직금 및 출국만기보험 신청 기한
          const [y, m, d] = departureDate.split('-').map(Number);
          const depDt = new Date(y, m - 1, d);
          depDt.setDate(depDt.getDate() - 30);
          const d30Iso = isoDate(depDt);

          const d30Title = '출국만기보험 및 퇴직금 신청 기한';
          const d30Desc = '출국 1개월 전 삼성화재 출국만기보험 신청 및 공항수령/계좌송금 접수';

          addEvent({
            title: d30Title,
            type: 'EXIT',
            date: d30Iso,
            time: '10:00',
            description: d30Desc,
            completed: false,
            auto: true,
          });

          // 2. 출국 당일 일정
          const exitTitle = '예상 출국일';
          const exitDesc = '체류기간 만료 및 공항 출국 / 출국만기보험 수령';

          addEvent({
            title: exitTitle,
            type: 'EXIT',
            date: departureDate,
            time: '09:00',
            description: exitDesc,
            completed: false,
            auto: true,
          });
        }
      }
    }
  }, [
    step,
    departureDate,
    readyCount,
    claims.length,
    localProfile,
    updateExitProfile,
    signature,
    hydrated,
    addEvent,
    refreshFromBackend,
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
        <div className="space-y-4">
          {/* 배너 카드 */}
          <div className="rounded-3xl bg-gradient-to-br from-primary via-[#1D4A88] to-primary p-6 text-primary-foreground shadow-primary/20 shadow-xl">
            <div className="flex items-center gap-2 font-semibold text-xs opacity-90">
              <Plane className="size-4" />
              <span>{t('landing.f3.when')}</span>
            </div>
            <h2 className="mt-2 font-bold text-2xl tracking-tight">
              {t('exit.title')}
            </h2>
            <p className="mt-1 text-primary-foreground/80 text-sm">
              {t('exit.subtitle')}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 border-white/10 border-t pt-2 text-xs">
              <span className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
                {departureDate
                  ? `${t('profile.exitDate')}: ${formatKDate(departureDate)}`
                  : t('home.exitNone')}
              </span>
              <span className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
                {totalMonths !== null
                  ? `${t('home.monthsRecorded', { n: totalMonths })}`
                  : t('common.unknownValue')}
              </span>
            </div>
          </div>

          {/* 주요 확인 대상 안내 카드 */}
          <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="font-bold text-foreground text-sm">
              {t('exit.checklist.title')}
            </h3>
            <div className="grid gap-2.5 text-muted-foreground text-xs">
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <strong className="font-semibold text-foreground">
                    {t('exit.check1.title')}
                  </strong>
                  <p className="mt-0.5">{t('exit.check1.desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Plane className="mt-0.5 size-4 shrink-0 text-info" />
                <div>
                  <strong className="font-semibold text-foreground">
                    {t('exit.check2.title')}
                  </strong>
                  <p className="mt-0.5">{t('exit.check2.desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Wallet className="mt-0.5 size-4 shrink-0 text-signal" />
                <div>
                  <strong className="font-semibold text-foreground">
                    {t('exit.check3.title')}
                  </strong>
                  <p className="mt-0.5">{t('exit.check3.desc')}</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setStep(0)}
            size="lg"
            className="w-full rounded-2xl font-bold text-base shadow-lg shadow-primary/25"
          >
            {t('exit.step.start')}
            <ArrowRight className="ml-2 size-5" />
          </Button>
        </div>
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
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / STEP_TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* 0단계: 기본 체류 및 근무 정보 확인 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
              <h2 className="font-bold text-base text-foreground">
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
                  <span className="font-extrabold">
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
              <h2 className="font-bold text-base text-foreground">
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
              <h2 className="font-bold text-base text-foreground">
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
                <h2 className="font-bold text-base text-foreground">
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
                        <h3 className="font-bold text-foreground text-sm">
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
