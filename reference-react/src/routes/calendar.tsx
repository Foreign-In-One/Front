import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePayCycle } from "@/state/paycycle-context";
import { useT } from "@/i18n";
import { formatKDate, isoDate, monthLabel, payDayIso, won } from "@/lib/paycycle/format";
import type { CalendarEvent, EventCategory } from "@/lib/paycycle/types";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "금융권리 캘린더 · PayCycle AI" },
      {
        name: "description",
        content:
          "급여일, 입금 확인, 연말정산 준비, 출국 정산 일정을 월간 캘린더 하나로 모아 관리합니다.",
      },
      { property: "og:title", content: "금융권리 캘린더 · PayCycle AI" },
      {
        property: "og:description",
        content: "급여·세금·출국 일정을 월간 캘린더에서 한눈에 확인하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const CATEGORY_TONE: Record<EventCategory, "ok" | "warn" | "info" | "neutral"> = {
  급여: "ok",
  세금: "info",
  보험: "info",
  연금: "info",
  출국: "warn",
  프로필: "neutral",
  기타: "neutral",
};

const CATEGORIES: EventCategory[] = ["급여", "세금", "보험", "연금", "출국", "기타"];

function CalendarPage() {
  const { state, addEvent, removeEvent } = usePayCycle();
  const { t } = useT();
  const today = isoDate(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ title: string; category: EventCategory; date: string }>({
    title: "",
    category: "기타",
    date: today,
  });

  const period = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;

  /** 계약 급여일은 이벤트로 저장하지 않고 해당 월에 계산해서 표시한다. */
  const derived: CalendarEvent[] = useMemo(() => {
    const payDay = state.employment?.payDay;
    if (!payDay) return [];
    const date = payDayIso(period, payDay);
    const alreadyPaid = state.events.some(
      (e) => e.source === "paycheck" && e.date.startsWith(period),
    );
    if (alreadyPaid) return [];
    return [
      {
        id: `derived-payday-${period}`,
        date,
        category: "급여",
        source: "profile",
        title: "계약상 급여일",
        detail: "입금 여부를 확인하고 PayCheck로 대조해 보세요.",
        auto: true,
        kind: "권장",
      },
    ];
  }, [period, state.employment?.payDay, state.events]);

  const monthEvents = useMemo(
    () =>
      [...state.events, ...derived]
        .filter((e) => e.date.startsWith(period))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.events, derived, period],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of monthEvents) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [monthEvents]);

  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];

  const move = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const selectedEvents = byDay.get(selected) ?? [];

  const submit = () => {
    if (!draft.title.trim() || !draft.date) return;
    addEvent({
      date: draft.date,
      category: draft.category,
      source: "manual",
      title: draft.title.trim(),
      auto: false,
      kind: "권장",
    });
    setDraft({ title: "", category: "기타", date: selected });
    setAdding(false);
    toast.success("일정이 캘린더에 추가되었습니다.");
  };

  return (
    <AppShell title={t("cal.title")} subtitle={t("cal.subtitle")}>
      <section className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => move(-1)}
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-base font-bold text-foreground">{monthLabel(period)}</p>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => move(1)}
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <span key={`empty-${i}`} />;
            const events = byDay.get(iso) ?? [];
            const isToday = iso === today;
            const isSelected = iso === selected;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-secondary text-foreground"
                      : "text-foreground"
                }`}
              >
                {Number(iso.slice(8))}
                <span className="mt-1 flex h-1.5 items-center gap-0.5">
                  {events.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`size-1.5 rounded-full ${
                        isSelected
                          ? "bg-primary-foreground"
                          : e.category === "급여"
                            ? "bg-signal"
                            : e.category === "출국"
                              ? "bg-warn"
                              : "bg-info"
                      }`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{formatKDate(selected)} 일정</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft((d) => ({ ...d, date: selected }));
              setAdding((v) => !v);
            }}
          >
            <Plus className="size-4" /> 직접 추가
          </Button>
        </div>

        {adding ? (
          <div className="mt-3 space-y-3 rounded-2xl bg-card p-4 shadow-sm">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="예: 은행에서 납입증명서 발급"
              aria-label="일정 제목"
              className="h-12"
            />
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              aria-label="일정 날짜"
              className="h-12"
            />
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, category: c })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    draft.category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <Button onClick={submit} disabled={!draft.title.trim()} className="w-full">
              추가하기
            </Button>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {selectedEvents.length === 0 ? (
            <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-sm">
              이 날짜에 기록된 일정이 없습니다.
            </p>
          ) : (
            selectedEvents.map((e) => (
              <article key={e.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={CATEGORY_TONE[e.category]}>{e.category}</StatusPill>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {e.kind}
                      </span>
                    </div>
                    <p className="mt-2 text-[15px] font-bold text-foreground">{e.title}</p>
                    {e.detail ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {e.detail}
                      </p>
                    ) : null}
                    {typeof e.amount === "number" ? (
                      <p className="mt-1 text-sm font-bold text-foreground">{won(e.amount)}</p>
                    ) : null}
                  </div>
                  {e.id.startsWith("derived-") ? null : (
                    <button
                      type="button"
                      aria-label="일정 삭제"
                      onClick={() => removeEvent(e.id)}
                      className="text-muted-foreground"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold text-foreground">이번 달 전체 일정</h2>
        <div className="mt-2 space-y-2">
          {monthEvents.length === 0 ? (
            <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-sm">
              이 달에는 기록된 일정이 없습니다. 급여를 확인하면 자동으로 기록됩니다.
            </p>
          ) : (
            monthEvents.map((e) => (
              <button
                key={`list-${e.id}`}
                type="button"
                onClick={() => setSelected(e.date)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm"
              >
                <span className="w-14 shrink-0 text-xs font-bold text-muted-foreground">
                  {e.date.slice(5).replace("-", ".")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {e.title}
                </span>
                <StatusPill tone={CATEGORY_TONE[e.category]}>{e.category}</StatusPill>
              </button>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
