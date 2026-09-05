'use client';

import { CalendarClock, Globe, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { DateField } from '@/components/date-field';
import {
  ProfileField,
  ProfileSection,
} from '@/components/profile/profile-section';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LOCALES, type Translator, type UiLocale, useT } from '@/i18n';
import { VISA_CODES, visaInfo } from '@/i18n/visa';
import { dDay } from '@/lib/paycycle/rule-engine';
import type { EmploymentStatus } from '@/lib/paycycle/types';
import { usePayCycle } from '@/state/paycycle-context';

const STATUSES: EmploymentStatus[] = [
  'PRE_EMPLOYMENT',
  'EMPLOYED',
  'SEPARATED',
  'CHANGING',
];

function getStatusLabel(
  status: string | undefined,
  t: Translator['t'],
): string {
  if (!status) return '';
  const norm = status.toUpperCase();
  if (norm === 'EMPLOYED' || norm === 'WORKING')
    return t('profile.status.employed');
  if (norm === 'PRE_EMPLOYMENT' || norm === 'PRE')
    return t('profile.status.pre');
  if (norm === 'SEPARATED') return t('profile.status.separated');
  if (norm === 'CHANGING') return t('profile.status.changing');
  return status;
}

export default function ProfilePage() {
  const { state, hydrated, updateProfile, updateEmployment, resetAll } =
    usePayCycle();
  const { t, locale, setLocale } = useT();
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<EmploymentStatus | null>(
    null,
  );

  const profile = state.profile;
  const employment = state.employment;

  if (!hydrated) {
    return (
      <AppShell title={t('profile.title')}>
        <p className="text-muted-foreground text-sm">…</p>
      </AppShell>
    );
  }

  if (!profile || !employment) {
    return (
      <AppShell title={t('profile.title')}>
        <div className="rounded-3xl bg-card/90 p-6 text-center shadow-sm backdrop-blur-md">
          <p className="text-muted-foreground text-sm">{t('profile.empty')}</p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-4 font-bold text-base text-primary-foreground"
          >
            {t('profile.create')}
          </Link>
        </div>
      </AppShell>
    );
  }

  const exitIso =
    employment.exitDate.value && !employment.exitDate.unknown
      ? employment.exitDate.value
      : null;

  return (
    <AppShell title={t('profile.title')} subtitle={t('profile.subtitle')}>
      {/* 프로필 헤더 카드 (딥블루 그라데이션) */}
      <section className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 font-bold text-xs opacity-90">
          <UserRound className="size-4" /> {profile.nationality} ·{' '}
          {profile.visa}
        </div>
        <p className="mt-1.5 font-bold text-2xl tracking-tight">
          {profile.nickname}
        </p>
        <div className="mt-3.5 flex w-fit items-center gap-2 rounded-2xl bg-primary-foreground/15 px-3.5 py-2 font-bold text-xs backdrop-blur-md">
          <CalendarClock className="size-4" />
          {exitIso
            ? t('profile.dday', { n: dDay(exitIso) })
            : t('profile.ddayNone')}
        </div>
      </section>

      {/* 1. 사용자 기본정보 */}
      <ProfileSection title={t('profile.sec.user')}>
        <ProfileField label={t('profile.nickname')}>
          <Input
            value={profile.nickname}
            onChange={(e) => updateProfile({ nickname: e.target.value })}
            className="rounded-2xl border border-input bg-card font-bold text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
          />
        </ProfileField>
      </ProfileSection>

      {/* 2. 국적 / 체류자격 (비자) */}
      <ProfileSection title={t('profile.sec.visa')}>
        <ProfileField label={t('profile.nationality')}>
          <Input
            value={profile.nationality}
            onChange={(e) => updateProfile({ nationality: e.target.value })}
            className="rounded-2xl border border-input bg-card font-bold text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
          />
        </ProfileField>

        <ProfileField label={t('profile.visa')}>
          <select
            value={profile.visa}
            onChange={(e) => updateProfile({ visa: e.target.value })}
            className="w-full rounded-2xl border border-input bg-card p-3.5 font-bold text-foreground text-xs shadow-xs focus:ring-2 focus:ring-ring"
          >
            {VISA_CODES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {profile.visa ? (
            <p className="mt-2.5 rounded-2xl bg-muted/60 p-3.5 font-semibold text-foreground text-xs leading-relaxed shadow-xs">
              {visaInfo(locale, profile.visa)}
            </p>
          ) : null}
        </ProfileField>
      </ProfileSection>

      {/* 3. 근로상태 & 사업장 & 근무 시작일 & 급여일 & 예상 출국일 */}
      <ProfileSection title={t('profile.sec.work')}>
        <ProfileField label={t('profile.status')}>
          <div className="grid grid-cols-2 gap-2.5">
            {STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  if (employment.status === st) return;
                  setPendingStatus(st);
                }}
                className={`rounded-2xl p-3.5 font-bold text-xs transition-all ${
                  employment.status === st ||
                  (
                    (employment.status as string) === 'WORKING' &&
                      st === 'EMPLOYED'
                  )
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/60 bg-card text-muted-foreground shadow-xs hover:text-foreground'
                }`}
              >
                {getStatusLabel(st, t)}
              </button>
            ))}
          </div>
        </ProfileField>

        <ProfileField label={t('profile.workplace')}>
          <Input
            value={employment.workplace}
            onChange={(e) => updateEmployment({ workplace: e.target.value })}
            className="rounded-2xl border border-input bg-card font-bold text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
          />
        </ProfileField>

        <ProfileField label={t('profile.workStart')}>
          <DateField
            label={t('profile.workStart')}
            value={employment.workStartDate}
            onChange={(next) => updateEmployment({ workStartDate: next })}
            rule={{ noFuture: true }}
          />
        </ProfileField>

        <ProfileField label={t('profile.payDay')}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={31}
              placeholder={t('ob.q.payDay')}
              value={employment.payDay ?? ''}
              onChange={(e) =>
                updateEmployment({
                  payDay: e.target.value
                    ? Number.parseInt(e.target.value, 10)
                    : null,
                })
              }
              className="rounded-2xl border border-input bg-card font-bold text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="font-bold text-muted-foreground text-xs">
              {t('profile.payDaySuffix')}
            </span>
          </div>
        </ProfileField>

        <ProfileField label={t('profile.exitDate')}>
          <DateField
            label={t('profile.exitDate')}
            value={employment.exitDate}
            onChange={(next) => updateEmployment({ exitDate: next })}
            rule={{ noPast: true }}
          />
        </ProfileField>
      </ProfileSection>

      {/* 4. 언어 선택 */}
      <ProfileSection title={t('common.language')}>
        <div className="grid grid-cols-2 gap-2.5">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLocale(l.code as UiLocale)}
              className={`flex items-center justify-between rounded-2xl p-3.5 font-bold text-xs transition-all ${
                locale === l.code
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/60 bg-card text-muted-foreground shadow-xs hover:text-foreground'
              }`}
            >
              <span>{l.label}</span>
              {locale === l.code && <Globe className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </ProfileSection>

      {/* 초기화 버튼 */}
      <div className="mt-6">
        <Button
          variant="ghost"
          className="h-12 w-full rounded-2xl bg-destructive/5 font-bold text-destructive text-xs shadow-xs transition-colors hover:bg-destructive/10"
          onClick={() => {
            resetAll();
            toast.success(t('profile.resetDone'));
            router.push('/onboarding');
          }}
        >
          <Trash2 className="mr-2 size-4" />
          {t('profile.reset')}
        </Button>
      </div>

      {/* 근로 상태 변경 확인 모달 다이얼로그 */}
      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
      >
        <DialogContent className="z-[100] rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="font-bold text-base text-foreground">
              {t('profile.statusModal.title')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              {pendingStatus &&
                t('profile.statusModal.desc', {
                  from: getStatusLabel(employment.status, t),
                  to: getStatusLabel(pendingStatus, t),
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2.5 pt-4">
            <Button
              variant="ghost"
              className="rounded-2xl font-bold text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setPendingStatus(null)}
            >
              {t('profile.statusModal.cancel')}
            </Button>
            <Button
              className="rounded-2xl font-bold text-xs"
              onClick={() => {
                if (pendingStatus) {
                  updateEmployment({ status: pendingStatus });
                  toast.success(t('common.done'));
                  setPendingStatus(null);
                }
              }}
            >
              {t('profile.statusModal.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
