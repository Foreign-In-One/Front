import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

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
    <div className="pc-rise flex min-h-[60vh] flex-col justify-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        {icon}
      </div>
      <h2 className="mt-5 text-2xl leading-snug font-bold text-foreground">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
      <Button onClick={onStart} className="mt-8 h-14 w-full rounded-2xl text-base font-bold">
        {cta}
        <ArrowRight className="size-4" />
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("common.prev")}
          onClick={onPrev}
          className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {index + 1}/{total}
        </span>
      </div>

      <div key={index} className="pc-rise mt-8">
        <h2 className="text-xl leading-snug font-bold text-foreground">{title}</h2>
        {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
        <div className="mt-6">{children}</div>
      </div>

      {footerExtra ? <div className="mt-5">{footerExtra}</div> : null}

      {onNext ? (
        <div className="mt-8 flex gap-3">
          <Button
            variant="secondary"
            onClick={onPrev}
            className="h-14 rounded-2xl px-6 text-base font-semibold"
          >
            {t("common.prev")}
          </Button>
          <Button
            onClick={onNext}
            disabled={nextDisabled}
            className="h-14 flex-1 rounded-2xl text-base font-bold"
          >
            {nextLabel ?? t("common.next")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** 중요도 색상 규칙: 🔴 반드시 확인 / 🟠 추가 확인 / 🟢 확인 완료 / 🔵 안내 */
export type Level = "critical" | "warn" | "ok" | "info";

export const LEVEL_CLASS: Record<Level, string> = {
  critical: "border-destructive/40 bg-destructive/10",
  warn: "border-warn/40 bg-warn-soft",
  ok: "border-signal/40 bg-signal-soft",
  info: "border-info/40 bg-info-soft",
};

export const LEVEL_DOT: Record<Level, string> = {
  critical: "🔴",
  warn: "🟠",
  ok: "🟢",
  info: "🔵",
};

export function LevelCard({
  level,
  children,
  className,
}: {
  level: Level;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", LEVEL_CLASS[level], className)}>{children}</div>
  );
}
