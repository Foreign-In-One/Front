'use client';

import {
  CalendarClock,
  History,
  Home,
  Plane,
  Receipt,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DemoSyncButton } from '@/components/demo-sync-button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { type DictKey, useT } from '@/i18n';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/dashboard', key: 'tab.home', icon: Home },
  { to: '/calendar', key: 'tab.calendar', icon: CalendarClock },
  { to: '/paycheck', key: 'tab.pay', icon: Wallet },
  { to: '/taxcheck', key: 'tab.tax', icon: Receipt },
  { to: '/exitcheck', key: 'tab.exit', icon: Plane },
] as const;

interface NavbarProps {
  title: string;
  subtitle?: string;
}

export function Navbar({ title, subtitle }: NavbarProps) {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <>
      <header className="sticky top-0 z-30 border-border/70 border-b bg-background/85 px-4 py-3.5 backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-bold text-foreground text-lg tracking-tight sm:text-xl">
              {title}
            </h1>

            {subtitle ? (
              <p className="truncate text-muted-foreground text-xs sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <DemoSyncButton />

            <Link
              href="/records"
              aria-label={t('records.nav')}
              title={t('records.title')}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary"
            >
              <History className="size-5" />
            </Link>

            <Link
              href="/profile"
              aria-label={t('profile.nav')}
              title={t('profile.title')}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary"
            >
              <UserRound className="size-5" />
            </Link>

            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-border border-t bg-card/95 backdrop-blur">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const active = pathname === tab.to;
            const Icon = tab.icon;

            return (
              <li key={tab.to} className="flex-1">
                <Link
                  href={tab.to}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 font-medium text-[10px] transition-colors sm:text-[11px]',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-5 transition-transform',
                      active && 'scale-110 text-primary',
                    )}
                  />
                  <span>{t(tab.key as DictKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
