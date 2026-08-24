"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export type Level = "SUCCESS" | "WARNING" | "DANGER" | "NEED_INFO";

/** 기능 시작 화면 — 한 화면에 목적 하나와 시작 버튼 하나. */
export function WizardStart({
  icon,
  title,
  description,
  cta,
  onStart,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  cta: string;
  onStart: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="pc-rise flex min-h-[60vh] flex-col justify-center py-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md">
        {icon}
      </div>
      <h2 className="mt-5 text-2xl leading-snug font-black text-foreground whitespace-pre-line">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

      {children ? <div className="mt-5">{children}</div> : null}

      <Button
        onClick={onStart}
        className="mt-8 h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
      >
        {cta}
        <ArrowRight className="ml-2 size-5" />
      </Button>
    </div>
  );
}

/** 한 화면 = 한 단계. 진행 표시 + 본문 + 하단 [이전]/[다음]. */
export function WizardStep({
  index,
  total,
  title,
  hint,
  children,
  onPrev,
  onNext,
  nextLabel,
  nextDisabled,
  footerExtra,
}: {
  index: number;
  total: number;
  title: string;
  hint?: string | undefined;
  children: ReactNode;
  onPrev: () => void;
  onNext?: (() => void) | undefined;
  nextLabel?: string | undefined;
  nextDisabled?: boolean | undefined;
  footerExtra?: ReactNode | undefined;
}) {
  const { t } = useT();
  const progress = ((index + 1) / total) * 100;

  return (
    <div className="pb-4">
      {/* 상단 프로그레스 트래커 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("common.prev")}
          onClick={onPrev}
          className="flex size-9 items-center justify-center rounded-2xl bg-card text-muted-foreground border border-border/60 shadow-sm hover:text-foreground hover:bg-muted transition-all"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-500 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-bold text-muted-foreground">
          {index + 1}/{total}
        </span>
      </div>

      {/* 단계별 타이틀 & 힌트 */}
      <div key={index} className="pc-rise mt-6">
        <h2 className="text-xl leading-snug font-bold text-foreground">{title}</h2>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        <div className="mt-5">{children}</div>
      </div>

      {footerExtra ? <div className="mt-5">{footerExtra}</div> : null}

      {/* 하단 네비게이션 액션 버튼 */}
      {onNext ? (
        <div className="mt-8 flex gap-3">
          <Button
            type="button"
            disabled={nextDisabled}
            onClick={onNext}
            className="h-13 w-full rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground font-bold shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {nextLabel ?? t("common.next")}
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** 결과 레포트 레벨 카드 */
export function LevelCard({
  level,
  badge,
  title,
  description,
}: {
  level: Level;
  badge: string;
  title: string;
  description: string;
}) {
  const styles: Record<
    Level,
    { bg: string; border: string; text: string; icon: typeof CheckCircle2 }
  > = {
    SUCCESS: {
      bg: "bg-info-soft",
      border: "border-info/30",
      text: "text-info-foreground dark:text-info",
      icon: CheckCircle2,
    },
    WARNING: {
      bg: "bg-warn-soft",
      border: "border-warn/30",
      text: "text-warn-foreground dark:text-warn",
      icon: AlertTriangle,
    },
    DANGER: {
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      text: "text-destructive",
      icon: XCircle,
    },
    NEED_INFO: {
      bg: "bg-info-soft",
      border: "border-info/30",
      text: "text-info-foreground dark:text-info",
      icon: Info,
    },
  };

  const current = styles[level];
  const Icon = current.icon;

  return (
    <div
      className={cn(
        "rounded-3xl border p-5 shadow-md transition-all backdrop-blur",
        current.bg,
        current.border,
        current.text
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-5 shrink-0" />
        <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-black shadow-xs">
          {badge}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-bold leading-snug">{title}</h3>
      <p className="mt-2 text-xs opacity-90 leading-relaxed">{description}</p>
    </div>
  );
}

