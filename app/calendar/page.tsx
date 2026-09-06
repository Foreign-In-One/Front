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

function formatPeriodStr(raw: string, locale: UiLocale): string {
  const mMatch = raw.match(/(?:(\d{4})[-년.\s]*)?(\d{1,2})월?/);
  if (!mMatch) return raw;
  const year = mMatch[1];
  const month = Number(mMatch[2]);

  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthNameEn = monthNamesEn[month - 1] || `${month}`;

  if (locale === "en") {
    return year ? `${monthNameEn} ${year}` : monthNameEn;
  }
  if (locale === "vi") {
    return year ? `Tháng ${month} năm ${year}` : `Tháng ${month}`;
  }
  if (locale === "zh") {
    return year ? `${year}年${month}月` : `${month}月`;
  }
  return raw;
}

function formatAmountInText(amtText: string, locale: UiLocale): string {
  if (!amtText) return "";
  const clean = amtText.replace(/원$/, "").trim();
  if (locale === "en") return `${clean} KRW`;
  if (locale === "vi") return `${clean} won`;
  if (locale === "zh") return `${clean} 韩元`;
  return `${clean}원`;
}

function localizeEventTitle(title: string, locale: UiLocale): string {
  if (!title || locale === "ko") return title;

  // 1. "8월 급여 점검 완료 (2,300,000원)" or "2026-08 급여 점검 완료"
  const checkMatch = title.match(/^(\d{4}[-년.\s]*\d{1,2}월?|\d{1,2}월)\s*급여\s*점검\s*완료(?:\s*\((.*?)\))?$/);
  if (checkMatch) {
    const periodStr = formatPeriodStr(checkMatch[1], locale);
    const amount = checkMatch[2] ? ` (${formatAmountInText(checkMatch[2], locale)})` : "";
    if (locale === "en") return `${periodStr} Salary Check Completed${amount}`;
    if (locale === "vi") return `Hoàn tất kiểm tra lương ${periodStr}${amount}`;
    if (locale === "zh") return `${periodStr} 工资核对完成${amount}`;
  }

  // 2. "8월 급여 입금 (2,300,000원)"
  const depositMatch = title.match(/^(\d{4}[-년.\s]*\d{1,2}월?|\d{1,2}월)\s*급여\s*입금(?:\s*\((.*?)\))?$/);
  if (depositMatch) {
    const periodStr = formatPeriodStr(depositMatch[1], locale);
    const amount = depositMatch[2] ? ` (${formatAmountInText(depositMatch[2], locale)})` : "";
    if (locale === "en") return `${periodStr} Salary Deposit${amount}`;
    if (locale === "vi") return `Chuyển lương ${periodStr}${amount}`;
    if (locale === "zh") return `${periodStr} 工资入账${amount}`;
  }

  // 3. "2025년 귀속 세무 점검 완료"
  const taxCheckMatch = title.match(/^(\d{4})년?\s*귀속\s*세무\s*점검\s*완료$/);
  if (taxCheckMatch) {
    const year = taxCheckMatch[1];
    if (locale === "en") return `${year} Tax Check Completed`;
    if (locale === "vi") return `Hoàn tất kiểm tra thuế năm ${year}`;
    if (locale === "zh") return `${year}年度税务核对完成`;
  }

  // 4. "연말정산 소득·세액공제 준비 점검 완료"
  if (/^연말정산\s*(?:소득[·\s]*세액공제\s*준비\s*)?점검\s*완료$/.test(title)) {
    if (locale === "en") return "Year-End Tax Settlement & Deduction Check Completed";
    if (locale === "vi") return "Hoàn tất kiểm tra khấu trừ thuế quyết toán cuối năm";
    if (locale === "zh") return "年终结算所得税扣除核对完成";
  }

  // 5. "급여 대조"
  if (/^급여\s*대조$/.test(title)) {
    if (locale === "en") return "Pay Check";
    if (locale === "vi") return "Kiểm tra lương";
    if (locale === "zh") return "工资核对";
  }

  // 6. "정기 급여일 (25일)"
  const paydayMatch = title.match(/^정기\s*급여일(?:\s*\((\d+)일\))?$/);
  if (paydayMatch) {
    const day = paydayMatch[1];
    if (locale === "en") return `Regular Payday${day ? ` (Day ${day})` : ""}`;
    if (locale === "vi") return `Ngày nhận lương định kỳ${day ? ` (Ngày ${day})` : ""}`;
    if (locale === "zh") return `常规发薪日${day ? `（${day}日）` : ""}`;
  }

  // 7. "예상 출국일"
  if (title === "예상 출국일") {
    if (locale === "en") return "Expected Departure Date";
    if (locale === "vi") return "Ngày dự kiến xuất cảnh";
    if (locale === "zh") return "预计出境日";
  }

  return title;
}

function localizeEventDescription(desc: string | undefined, locale: UiLocale): string | undefined {
  if (!desc || locale === "ko") return desc;

  // 1. "통장 입금액이 임금명세서 실지급액보다 320,080원 더 많습니다."
  const moreMatch = desc.match(/통장\s*입금액이\s*임금명세서\s*실지급액보다\s*(.+?)\s*더\s*많습니다\.?/);
  if (moreMatch) {
    const amt = formatAmountInText(moreMatch[1], locale);
    if (locale === "en") return `Bank deposit is ${amt} more than payslip net pay.`;
    if (locale === "vi") return `Số tiền vào tài khoản nhiều hơn thực lĩnh trên phiếu lương ${amt}.`;
    if (locale === "zh") return `银行入账金额比工资单实发金额多 ${amt}。`;
  }

  // 2. "통장 입금액이 임금명세서 실지급액보다 300,000원 더 적습니다." / "부족합니다."
  const lessMatch = desc.match(/통장\s*입금액이\s*임금명세서\s*실지급액보다\s*(.+?)\s*(?:더\s*적습니다|부족합니다)\.?/);
  if (lessMatch) {
    const amt = formatAmountInText(lessMatch[1], locale);
    if (locale === "en") return `Bank deposit is ${amt} less than payslip net pay.`;
    if (locale === "vi") return `Số tiền vào tài khoản ít hơn thực lĩnh trên phiếu lương ${amt}.`;
    if (locale === "zh") return `银行入账金额比工资单实发金额少 ${amt}。`;
  }

  // 3. "자료 확인이 필요하여 세액 비교를 제공하지 않았습니다."
  if (/자료\s*확인이\s*필요하여\s*세액\s*비교를\s*제공하지\s*않았습니다\.?/.test(desc)) {
    if (locale === "en") return "Tax comparison was not provided due to required document verification.";
    if (locale === "vi") return "Không cung cấp so sánh thuế do cần xác minh thêm tài liệu.";
    if (locale === "zh") return "因需进一步核对材料，暂未提供税额比对。";
  }

  // 4. "연말정산 소득·세액공제 준비 점검 완료"
  if (/연말정산\s*소득[·\s]*세액공제\s*준비\s*점검\s*완료/.test(desc)) {
    if (locale === "en") return "Year-end tax settlement income & deduction check completed.";
    if (locale === "vi") return "Hoàn tất kiểm tra chuẩn bị khấu trừ thu nhập và thuế cuối năm.";
    if (locale === "zh") return "年终结算所得税及税额扣除准备已核对完成。";
  }

  // 5. "연말정산 및 세무 점검 결과 확인"
  if (/연말정산\s*및\s*세무\s*점검\s*결과\s*확인/.test(desc)) {
    if (locale === "en") return "Check year-end tax settlement and tax inspection results.";
    if (locale === "vi") return "Xem kết quả quyết toán và kiểm tra thuế cuối năm.";
    if (locale === "zh") return "查看年终结算及税务核对结果。";
  }

  // 6. "임금명세서 실지급액과 실제 입금액이 일치합니다."
  if (desc.includes("실제 입금액이 일치합니다") || desc.includes("정상 입금 확인")) {
    if (locale === "en") return "Payslip net pay matches the actual deposit amount.";
    if (locale === "vi") return "Thực lĩnh trên phiếu lương khớp hoàn toàn với số tiền vào tài khoản.";
    if (locale === "zh") return "工资单实发金额与实际入账金额一致。";
  }

  // 7. "한국정밀 2026-08 급여 차액 확인 필요"
  const diffWorkplaceMatch = desc.match(/(.+?)\s+(\d{4}[-년.\s]*\d{1,2}월?|\d{1,2}월)\s+급여\s+차액 확인 필요/);
  if (diffWorkplaceMatch) {
    const workplace = diffWorkplaceMatch[1];
    const period = formatPeriodStr(diffWorkplaceMatch[2], locale);
    if (locale === "en") return `${workplace} ${period} salary: Discrepancy detected - review required.`;
    if (locale === "vi") return `Lương ${period} tại ${workplace}: Cần kiểm tra lại do có chênh lệch.`;
    if (locale === "zh") return `${workplace} ${period} 工资存在差额，需进一步核对。`;
  }

  // 8. "계약상 월 급여지급일"
  if (desc.includes("계약상 월 급여지급일")) {
    if (locale === "en") return "Contractual monthly salary payment date";
    if (locale === "vi") return "Ngày trả lương hàng tháng theo hợp đồng";
    if (locale === "zh") return "合同约定的每月发薪日";
  }

  // 9. "체류/비자 만료 및 예상 출국일"
  if (desc.includes("체류/비자 만료 및 예상 출국일")) {
    if (locale === "en") return "Visa expiration and expected departure date";
    if (locale === "vi") return "Hết hạn visa và ngày dự kiến xuất cảnh";
    if (locale === "zh") return "签证到期及预计出境日";
  }

  return desc;
}

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
                    const meta = EVENT_META[evt.type] || EVENT_META.PERSONAL;
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
            const meta = EVENT_META[evt.type] || EVENT_META.PERSONAL;
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

                    <p className="mt-1.5 text-sm font-extrabold text-foreground">
                      {localizeEventTitle(evt.title, locale)}
                    </p>
                    {evt.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {localizeEventDescription(evt.description, locale)}
                      </p>
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
