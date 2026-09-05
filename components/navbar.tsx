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
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DemoSyncButton } from '@/components/demo-sync-button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { type DictKey, useT } from '@/i18n';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/dashboard', key: 'tab.home', icon: Home },
  { to: '/paycheck', key: 'tab.pay', icon: Wallet },
  { to: '/taxcheck', key: 'tab.tax', icon: Receipt },
  { to: '/exitcheck', key: 'tab.exit', icon: Plane },
  { to: '/calendar', key: 'tab.calendar', icon: CalendarClock },
] as const;

interface NavbarProps {
  title?: string;
  subtitle?: string;
}

export function Navbar({ title: _title, subtitle: _subtitle }: NavbarProps = {}) {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <>
      <header className="sticky top-0 z-30 border-border/70 border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <div className="flex shrink-0 items-center">
            <Link
              href="/dashboard"
              className="flex items-center transition-opacity hover:opacity-85 active:scale-95"
              aria-label="Dashboard"
            >
              <Image
                src="/logo.svg"
                alt="Foreign In One"
                width={138}
                height={41}
                className="h-8 w-auto object-contain sm:h-9"
                style={{ width: "auto" }}
                priority
              />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <DemoSyncButton />

            <Link
              href="/records"
              aria-label={t('records.nav')}
              title={t('records.title')}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary active:scale-95"
            >
              <History className="size-5" />
            </Link>

            <Link
              href="/profile"
              aria-label={t('profile.nav')}
              title={t('profile.title')}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary active:scale-95"
            >
              <UserRound className="size-5" />
            </Link>

            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-border border-t bg-card/95 shadow-lg backdrop-blur">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const active = pathname === tab.to;
            const Icon = tab.icon;

            return (
              <li key={tab.to} className="flex-1">
                <Link
                  href={tab.to}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 font-semibold text-[10px] transition-all sm:text-[11px]',
                    active
                      ? 'font-bold text-primary'
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
