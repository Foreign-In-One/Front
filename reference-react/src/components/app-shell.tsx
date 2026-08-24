import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, History, Home, Plane, Receipt, UserRound, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { ChatDock } from "@/components/chat-dock";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT, type DictKey } from "@/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", key: "tab.home", icon: Home },
  { to: "/calendar", key: "tab.calendar", icon: CalendarClock },
  { to: "/paycheck", key: "tab.pay", icon: Wallet },
  { to: "/taxcheck", key: "tab.tax", icon: Receipt },
  { to: "/exitcheck", key: "tab.exit", icon: Plane },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              to="/records"
              aria-label={t("records.nav")}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary"
            >
              <History className="size-5" />
            </Link>
            <Link
              to="/profile"
              aria-label={t("profile.nav")}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:text-primary"
            >
              <UserRound className="size-5" />
            </Link>
            <LanguageSwitcher />
          </div>
        </div>

      </header>

      <main className="mx-auto max-w-xl px-5 py-5">{children}</main>

      <ChatDock />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const active = pathname === tab.to;
            const Icon = tab.icon;
            return (
              <li key={tab.to} className="flex-1">
                <Link
                  to={tab.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active && "scale-110 transition-transform")} />
                  {t(tab.key as DictKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
