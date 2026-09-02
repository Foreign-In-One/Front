"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Landmark,
  Plane,
  Plus,
  Receipt,
  Trash2,
  Wallet,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePayCycle } from "@/state/paycycle-context";
import { useT, type TKey } from "@/i18n";
import type { UiLocale } from "@/i18n/dict";
import { isoDate, formatKDate } from "@/lib/paycycle/format";
import type { CalendarEvent, EventType } from "@/lib/paycycle/types";

const EVENT_META: Record<
  EventType,
  { labelKey: TKey; tone: string; chipStyle: string; icon: typeof CalendarClock }
> = {
  PAYDAY: {
    labelKey: "cal.type.payday",
    tone: "bg-info-soft/70 text-info-foreground dark:text-info border border-info/20 shadow-xs",
    chipStyle: "bg-info/20 text-info-foreground dark:text-info shadow-xs",
    icon: Wallet,
  },
  PAYCHECK: {
    labelKey: "cal.type.paycheck",
    tone: "bg-primary/10 text-primary dark:text-primary-foreground border border-primary/20 shadow-xs",
    chipStyle: "bg-primary/20 text-primary dark:text-primary-foreground shadow-xs",
    icon: Landmark,
  },
  TAX: {
    labelKey: "cal.type.tax",
    tone: "bg-purple-500/10 text-purple-900 dark:text-purple-200 border border-purple-500/20 shadow-xs",
    chipStyle: "bg-purple-500/20 text-purple-700 dark:text-purple-300 shadow-xs",
    icon: Receipt,
  },
  EXIT: {
    labelKey: "cal.type.exit",
    tone: "bg-warn-soft/70 text-warn-foreground dark:text-warn border border-warn/20 shadow-xs",
    chipStyle: "bg-warn/20 text-warn-foreground dark:text-warn shadow-xs",
    icon: Plane,
  },
  PERSONAL: {
    labelKey: "cal.type.personal",
    tone: "bg-card text-foreground border border-border/80 shadow-xs",
    chipStyle: "bg-muted text-muted-foreground shadow-xs",
    icon: CalendarClock,
  },
};

const WEEKDAYS_MAP: Record<UiLocale, string[]> = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  vi: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
  zh: ["日", "一", "二", "三", "四", "五", "六"],
};

export default function CalendarPage() {
  const { state, hydrated, addEvent, removeEvent, toggleEvent, refreshFromBackend } = usePayCycle();
  const { t, locale } = useT();
  const weekdays = WEEKDAYS_MAP[locale] || WEEKDAYS_MAP.ko;

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => isoDate(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void refreshFromBackend();
  }, [refreshFromBackend]);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<EventType>("PERSONAL");
  const [newTime, setNewTime] = useState("09:00");
  const [newDesc, setNewDesc] = useState("");

  const currentYear = cursor.getFullYear();
  const currentMonth = cursor.getMonth();

  const allEvents = useMemo(() => {
    const list: CalendarEvent[] = [];
    const todayIso = isoDate(new Date());
    const userPayDay = state.employment?.payDay || 25;

    // 1. 기존 이벤트 중 미래 날짜의 PAYCHECK(COMPLETED) 이벤트는 완료가 아닌 '급여 예정(PAYDAY, false)'으로 정규화
    for (const evt of state.events) {
      const isFuture = evt.date > todayIso;
      if (isFuture && evt.type === "PAYCHECK") {
        list.push({
          ...evt,
          type: "PAYDAY",
          title: t("cal.sys.paydayTitle", { day: userPayDay }),
          description: t("cal.sys.paydayDesc"),
          completed: false,
        });
      } else {
        list.push(evt);
      }
    }

    // 2. 시스템 월급날 자동 이벤트 (해당 날짜에 이미 PAYDAY 이벤트가 없는 경우에만 추가하여 중복 방지)
    if (state.employment?.payDay) {
      const day = Math.min(state.employment.payDay, 28);
      const payIso = isoDate(new Date(currentYear, currentMonth, day));
      const hasPayDayOnDate = list.some((e) => e.date === payIso && e.type === "PAYDAY");
      if (!hasPayDayOnDate) {
        list.push({
          id: `sys-payday-${payIso}`,
          title: t("cal.sys.paydayTitle", { day: state.employment.payDay }),
          type: "PAYDAY",
          date: payIso,
          time: "09:00",
          description: t("cal.sys.paydayDesc"),
          sourceType: "PAYDAY",
        });
      }
    }

    // 3. 예상 출국일 이벤트 (중복 방지)
    if (state.employment?.exitDate?.value && !state.employment.exitDate.unknown) {
      const hasExitOnDate = list.some(
        (e) => e.date === state.employment?.exitDate?.value && e.type === "EXIT"
      );
      if (!hasExitOnDate) {
        list.push({
          id: `sys-exit-${state.employment.exitDate.value}`,
          title: t("cal.sys.exitTitle"),
          type: "EXIT",
          date: state.employment.exitDate.value,
          time: "10:00",
          description: t("cal.sys.exitDesc"),
          sourceType: "EXIT",
        });
      }
    }

    return list;
  }, [state.events, state.employment, currentYear, currentMonth, t]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: { dateIso: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const prevDate = new Date(currentYear, currentMonth - 1, prevMonthDays - i);
      days.push({ dateIso: isoDate(prevDate), dayNum: prevMonthDays - i, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(currentYear, currentMonth, i);
      days.push({ dateIso: isoDate(currDate), dayNum: i, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      days.push({ dateIso: isoDate(nextDate), dayNum: i, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  const selectedDayEvents = useMemo(() => {
    return allEvents
      .filter((e) => e.date === selectedDate)
      .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
  }, [allEvents, selectedDate]);

  if (!hydrated) {
    return (
      <AppShell title={t("cal.title")}>
        <p className="text-sm text-muted-foreground">…</p>
      </AppShell>
    );
  }

  const prevMonth = () => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error(t("cal.err.noTitle"));
      return;
    }
    addEvent({
      title: newTitle.trim(),
      type: newType,
      date: selectedDate,
      time: newTime || "09:00",
      completed: false,
      description: newDesc.trim() || undefined,
    });
    toast.success(t("cal.addSuccess"));
    setNewTitle("");
    setNewDesc("");
    setDialogOpen(false);
  };

  return (
    <AppShell title={t("cal.title")} subtitle={t("cal.subtitle")}>
      {/* 1. 달력 상단 헤더 */}
      <div className="flex items-center justify-between rounded-3xl bg-card border border-border/70 p-5 shadow-xs backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          className="rounded-2xl bg-background border border-border/60 shadow-xs hover:scale-105 transition-all"
        >
          <ChevronLeft className="size-5 text-primary" />
        </Button>

        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-primary" />
          <h2 className="text-lg font-black text-foreground tracking-tight">
            {t("cal.yearMonth", { year: currentYear, month: currentMonth + 1 })}
          </h2>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="rounded-2xl bg-background border border-border/60 shadow-xs hover:scale-105 transition-all"
        >
          <ChevronRight className="size-5 text-primary" />
        </Button>
      </div>

      {/* 2. 7열 달력 그리드 */}
      <div className="mt-5 rounded-3xl bg-card border border-border/70 p-5 shadow-xs backdrop-blur-md space-y-2">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center pb-3 border-b border-border/40">
          {weekdays.map((w, idx) => (
            <span
              key={w}
              className={`text-xs font-black tracking-wide ${
                idx === 0 ? "text-destructive" : idx === 6 ? "text-info" : "text-muted-foreground"
              }`}
            >
              {w}
            </span>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1.5 pt-2">
          {calendarDays.slice(0, 35).map((d, idx) => {
            const isSelected = d.dateIso === selectedDate;
            const isToday = d.dateIso === isoDate(new Date());
            const dayEvents = allEvents.filter((e) => e.date === d.dateIso);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(d.dateIso)}
                className={`relative flex flex-col justify-between rounded-2xl p-1.5 min-h-[4.4rem] text-xs transition-all overflow-hidden border ${
                  !d.isCurrentMonth ? "opacity-30 border-transparent" : "opacity-100"
                } ${
                  isSelected
                    ? "bg-gradient-to-br from-primary to-[#1D4A88] text-primary-foreground font-black border-primary shadow-md shadow-primary/20 scale-[1.02] z-10"
                    : isToday
                    ? "bg-primary/10 font-bold text-primary border-primary/30 shadow-xs"
                    : "bg-background/80 hover:bg-muted/80 text-foreground font-semibold border-border/50 shadow-xs hover:scale-[1.01]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[11px] font-black ${isSelected ? "text-primary-foreground" : ""}`}>
                    {d.dayNum}
                  </span>
                  {dayEvents.length > 2 && (
                    <span className={`text-[9px] font-black px-1.5 rounded-full ${isSelected ? "bg-white/25 text-white" : "bg-primary/15 text-primary shadow-2xs"}`}>
                      +{dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="w-full space-y-0.5 mt-1">
                  {dayEvents.slice(0, 2).map((evt) => {
                    const meta = EVENT_META[evt.type];
                    return (
                      <div
                        key={evt.id}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[9px] font-black text-left leading-tight transition-all ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : meta.chipStyle
                        }`}
                      >
                        {t(meta.labelKey)}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 선택된 날짜의 Todo 목록 카세트 */}
      <div className="mt-6 space-y-3 pc-rise">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-extrabold text-foreground">
              {t("cal.dayEventsCount", { date: formatKDate(selectedDate), count: selectedDayEvents.length })}
            </h3>
          </div>

          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="mr-1 size-4" />
            {t("cal.addBtn")}
          </Button>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="rounded-3xl bg-card border border-border/60 p-8 text-center text-xs font-semibold text-muted-foreground shadow-xs backdrop-blur-md">
            {t("cal.noSelectedEvents")}
          </div>
        ) : (
          selectedDayEvents.map((evt) => {
            const meta = EVENT_META[evt.type];
            const isDone = Boolean(evt.completed);

            return (
              <div
                key={evt.id}
                className={`flex items-start justify-between rounded-3xl p-5 shadow-xs backdrop-blur-md transition-all hover:scale-[1.01] ${meta.tone} ${
                  isDone ? "opacity-60 line-through" : ""
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => toggleEvent(evt.id)}
                    className="mt-0.5 text-primary hover:scale-110 transition-transform"
                  >
                    {isDone ? (
                      <CheckCircle2 className="size-5 fill-primary text-primary-foreground" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      {evt.time && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-black shadow-xs text-foreground">
                          <Clock className="size-3 text-primary" />
                          {evt.time}
                        </span>
                      )}
                      <span className="rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-black shadow-xs text-foreground">
                        {t(meta.labelKey)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-extrabold text-foreground">{evt.title}</p>
                    {evt.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{evt.description}</p>
                    )}
                  </div>
                </div>

                {!evt.id.startsWith("sys-") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 rounded-xl"
                    onClick={() => {
                      removeEvent(evt.id);
                      toast.success(t("cal.removeSuccess"));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 일정 추가 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border border-border bg-card text-card-foreground shadow-2xl z-[100]">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <CalendarIcon className="size-5 text-primary" />
              {t("cal.addDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                {t("cal.date")}
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 rounded-2xl text-xs font-bold border border-input bg-background text-foreground shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                {t("cal.time")}
              </label>
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="mt-1 rounded-2xl text-xs font-bold border border-input bg-background text-foreground shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                {t("cal.eventType")}
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as EventType)}
                className="mt-1 w-full rounded-2xl border border-input bg-background p-3.5 text-xs font-bold text-foreground shadow-xs focus:ring-2 focus:ring-ring"
              >
                {(Object.keys(EVENT_META) as EventType[]).map((k) => (
                  <option key={k} value={k}>
                    {t(EVENT_META[k].labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                {t("cal.eventTitle")}
              </label>
              <Input
                placeholder={t("cal.titlePlaceholder")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 rounded-2xl text-xs font-bold border border-input bg-background text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                {t("cal.eventDesc")}
              </label>
              <Input
                placeholder={t("cal.descPlaceholder")}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1 rounded-2xl text-xs font-bold border border-input bg-background text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                variant="ghost"
                className="rounded-2xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setDialogOpen(false)}
              >
                {t("common.close")}
              </Button>
              <Button
                onClick={handleCreate}
                className="rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.02] transition-all"
              >
                {t("common.done")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
