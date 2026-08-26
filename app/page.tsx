"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Wallet, CalendarClock, UserRound, Sparkles } from "lucide-react";

export default function HomePage() {
  const { t } = useT();

  return (
    <AppShell title={t("app.name")} subtitle={t("landing.badge")}>
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-xl shadow-primary/20 w-full">
          <Sparkles className="size-8 mx-auto opacity-90" />
          <h1 className="mt-4 text-2xl font-black whitespace-pre-line leading-tight">
            {t("landing.title")}
          </h1>
          <p className="mt-3 text-xs opacity-90 leading-relaxed max-w-sm mx-auto">
            {t("landing.sub")}
          </p>
        </div>

        <div className="w-full space-y-3 pt-2">
          <Link href="/paycheck" className="block">
            <Button size="lg" className="w-full rounded-2xl py-6 text-base font-bold shadow-md">
              <Wallet className="mr-2 size-5" />
              {t("tab.pay")} (급여 3중 대조)
            </Button>
          </Link>

          <Link href="/calendar" className="block">
            <Button variant="outline" size="lg" className="w-full rounded-2xl py-6 text-sm font-semibold">
              <CalendarClock className="mr-2 size-5" />
              {t("tab.calendar")} (일정 관리)
            </Button>
          </Link>

          <Link href="/profile" className="block">
            <Button variant="ghost" size="lg" className="w-full rounded-2xl py-6 text-sm font-semibold border border-border">
              <UserRound className="mr-2 size-5" />
              {t("profile.title")} (프로필 및 근로 조건)
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
