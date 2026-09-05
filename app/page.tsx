'use client';

import {
  ArrowRight,
  CalendarClock,
  Check,
  PlaneTakeoff,
  Receipt,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { LOCALES, type UiLocale, useT } from '@/i18n';
import { usePayCycle } from '@/state/paycycle-context';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const { state, hydrated, loadSample } = usePayCycle();
  const { t, locale, setLocale } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pickedLanguage, setPickedLanguage] = useState(false);

  /** ?new=1 로 접속하면 목업 프로필 유무와 상관없이 최초 방문 화면을 미리 볼 수 있다. */
  const forceFirstVisit = searchParams.get('new') === '1';

  if (!hydrated) return null;

  if (!state.profile || forceFirstVisit) {
    if (!pickedLanguage) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
          <div className="pc-rise w-full max-w-sm">
            <Brand label="PayCycle AI" />
            <h1 className="mt-8 font-bold text-2xl text-foreground">
              {t('land.pickLanguage')}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Select your language
            </p>
            <div className="mt-6 space-y-2.5">
              {LOCALES.map((item) => {
                const active = locale === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLocale(item.code as UiLocale)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 font-semibold text-base transition-all ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-md'
                        : 'border-border bg-card text-foreground'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active ? <Check className="size-5" /> : null}
                  </button>
                );
              })}
            </div>
            <Button
              onClick={() => setPickedLanguage(true)}
              className="mt-8 h-14 w-full rounded-2xl font-bold text-base"
            >
              {t('common.next')}
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
        <div className="pc-rise w-full max-w-sm">
          <Brand label={`PayCycle AI · ${t('landing.badge')}`} />
          <h1 className="mt-6 whitespace-pre-line font-bold text-2xl text-foreground leading-tight">
            {t('landing.title')}
          </h1>
          <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
            {t('landing.sub')}
          </p>

          <div className="mt-6 space-y-2.5">
            <Benefit
              icon={<WalletCards className="size-5" />}
              when={t('landing.f1.when')}
              text={t('landing.f1.text')}
            />
            <Benefit
              icon={<ReceiptText className="size-5" />}
              when={t('landing.f2.when')}
              text={t('landing.f2.text')}
            />
            <Benefit
              icon={<PlaneTakeoff className="size-5" />}
              when={t('landing.f3.when')}
              text={t('landing.f3.text')}
            />
          </div>

          <Button
            onClick={() => router.push('/onboarding')}
            className="mt-8 h-14 w-full rounded-2xl font-bold text-base"
          >
            {t('landing.cta')}
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
          <button
            type="button"
            onClick={() => {
              loadSample();
              router.push('/dashboard');
            }}
            className="mt-3 w-full rounded-2xl border border-border bg-card py-3.5 font-bold text-foreground text-sm"
          >
            ✨ {t('landing.sample')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell title={t('app.name')} subtitle={t('landing.badge')}>
      <div className="pc-rise flex flex-col items-center justify-center space-y-6 py-6 text-center">
        <div className="w-full rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="mx-auto size-8 opacity-90" />
          <h1 className="mt-4 whitespace-pre-line font-bold text-2xl leading-tight">
            {t('landing.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed opacity-90">
            {t('landing.sub')}
          </p>
        </div>

        <div className="w-full space-y-3 pt-2">
          <Link href="/dashboard" className="block">
            <Button
              size="lg"
              className="w-full rounded-2xl py-6 font-bold text-base shadow-md"
            >
              <Sparkles className="mr-2 size-5" />
              {t('landing.ctaBack')}
            </Button>
          </Link>

          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/paycheck" className="block">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-border/80 py-5 font-bold text-xs"
              >
                <Wallet className="mr-1.5 size-4 text-primary" />
                {t('tab.pay')}
              </Button>
            </Link>

            <Link href="/taxcheck" className="block">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-border/80 py-5 font-bold text-xs"
              >
                <Receipt className="mr-1.5 size-4 text-purple-600" />
                {t('tab.tax')}
              </Button>
            </Link>

            <Link href="/exitcheck" className="block">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-border/80 py-5 font-bold text-xs"
              >
                <PlaneTakeoff className="mr-1.5 size-4 text-warn" />
                {t('tab.exit')}
              </Button>
            </Link>

            <Link href="/calendar" className="block">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-border/80 py-5 font-bold text-xs"
              >
                <CalendarClock className="mr-1.5 size-4 text-info" />
                {t('tab.calendar')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Brand({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-bold text-muted-foreground text-xs shadow-xs">
      <ShieldCheck className="size-4 text-signal" />
      {label}
    </span>
  );
}

function Benefit({
  icon,
  when,
  text,
}: {
  icon: ReactNode;
  when: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="font-bold text-muted-foreground text-xs">{when}</p>
        <p className="font-semibold text-foreground text-sm">{text}</p>
      </div>
    </div>
  );
}
