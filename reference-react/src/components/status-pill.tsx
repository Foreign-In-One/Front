import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-signal-soft text-signal-foreground",
  warn: "bg-warn-soft text-warn-foreground",
  info: "bg-info-soft text-info-foreground",
  neutral: "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-signal",
  warn: "bg-warn",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} />
      {children}
    </span>
  );
}
