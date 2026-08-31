"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Wallet, CalendarClock, UserRound, Sparkles, Receipt, Plane } from "lucide-react";

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
          <Link href="/dashboard" className="block">
            <Button size="lg" className="w-full rounded-2xl py-6 text-base font-bold shadow-md">
              <Sparkles className="mr-2 size-5" />
              {t("landing.ctaBack")}
            </Button>
          </Link>

          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/paycheck" className="block">
              <Button variant="outline" className="w-full rounded-2xl py-5 text-xs font-bold border-border/80">
                <Wallet className="mr-1.5 size-4 text-primary" />
                {t("tab.pay")}
              </Button>
            </Link>

            <Link href="/taxcheck" className="block">
              <Button variant="outline" className="w-full rounded-2xl py-5 text-xs font-bold border-border/80">
                <Receipt className="mr-1.5 size-4 text-purple-600" />
                {t("tab.tax")}
              </Button>
            </Link>

            <Link href="/exitcheck" className="block">
              <Button variant="outline" className="w-full rounded-2xl py-5 text-xs font-bold border-border/80">
                <Plane className="mr-1.5 size-4 text-warn" />
                {t("tab.exit")}
              </Button>
            </Link>

            <Link href="/calendar" className="block">
              <Button variant="outline" className="w-full rounded-2xl py-5 text-xs font-bold border-border/80">
                <CalendarClock className="mr-1.5 size-4 text-info" />
                {t("tab.calendar")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
