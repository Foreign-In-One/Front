"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  History,
  Home,
  Plane,
  Receipt,
  UserRound,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { ChatDock } from "@/components/chat-dock";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DemoSyncButton } from "@/components/demo-sync-button";
import { useT, type DictKey } from "@/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", key: "tab.home", icon: Home },
  { to: "/paycheck", key: "tab.pay", icon: Wallet },
  { to: "/taxcheck", key: "tab.tax", icon: Receipt },
  { to: "/exitcheck", key: "tab.exit", icon: Plane },
  { to: "/calendar", key: "tab.calendar", icon: CalendarClock },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 px-4 py-3.5 backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <DemoSyncButton />
            <Link
              href="/records"
              aria-label={t("records.nav")}
              title={t("records.title")}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary active:scale-95"
            >
              <History className="size-5" />
            </Link>
            <Link
              href="/profile"
              aria-label={t("profile.nav")}
              title={t("profile.title")}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary active:scale-95"
            >
              <UserRound className="size-5" />
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5 sm:px-5">{children}</main>

      <ChatDock />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-lg backdrop-blur">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const active = pathname === tab.to;
            const Icon = tab.icon;
            return (
              <li key={tab.to} className="flex-1">
                <Link
                  href={tab.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-all sm:text-[11px]",
                    active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-5 transition-transform", active && "scale-110 text-primary")} />
                  <span>{t(tab.key as DictKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
