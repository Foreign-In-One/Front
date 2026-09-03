import type { DateValue } from "./types";

export function won(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "확인 불가";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function wonOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

/** 화면 표기는 항상 YYYY.MM.DD */
export function formatKDate(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}.${m}.${d}`;
}

export function displayDate(date: DateValue | null | undefined): string {
  if (!date) return "미입력";
  if (date.unknown) return "모름/미정";
  return date.value ? formatKDate(date.value) : "미입력";
}

/** "2025.03.01" / "2025-3-1" / "20250301" 을 ISO(YYYY-MM-DD)로 변환 */
export function parseKDate(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length !== 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  const iso = `${y}-${m}-${d}`;
  return isRealDate(iso) ? iso : null;
}

export function isRealDate(iso: string | null | undefined): boolean {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [, m, d] = parts;
  return `${m}.${d}`;
}

export function monthLabel(period: string | null | undefined): string {
  if (!period || typeof period !== "string" || !period.includes("-")) {
    return "";
  }
  const [y, m] = period.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function periodOf(date?: Date | null): string {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isoDate(date?: Date | null): string {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function daysBetween(from: Date, to: Date): number {
  if (!(from instanceof Date) || !(to instanceof Date)) return 0;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

export function addDays(iso: string | null | undefined, days: number): string {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "";
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

/** 월의 실제 마지막 날을 넘지 않는 급여일 ISO */
export function payDayIso(period: string | null | undefined, payDay: number): string {
  if (!period || typeof period !== "string" || !period.includes("-")) return "";
  const [y, m] = period.split("-").map(Number) as [number, number];
  if (!y || !m) return "";
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Math.max(payDay, 1), last);
  return `${period}-${String(day).padStart(2, "0")}`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ------------------------------- 날짜 검증 규칙 ------------------------------- */

export interface DateRule {
  /** 미래 날짜를 허용하지 않음 */
  noFuture?: boolean;
  /** 과거 날짜를 허용하지 않음 */
  noPast?: boolean;
  /** 이 날짜보다 빠르면 오류 */
  notBefore?: { iso: string; label: string } | undefined;
}

const MIN_YEAR = 1950;

export function validateDate(iso: string | null | undefined, rule: DateRule = {}): string | null {
  if (!iso || typeof iso !== "string") return "날짜를 입력해 주세요.";
  if (!isRealDate(iso)) return "날짜 형식이 올바르지 않습니다. 예: 2025.03.01";
  const year = Number(iso.slice(0, 4));
  const maxYear = new Date().getFullYear() + 20;
  if (year < MIN_YEAR || year > maxYear) {
    return `연도가 올바르지 않습니다. ${MIN_YEAR}년 ~ ${maxYear}년 사이로 입력해 주세요.`;
  }
  const today = isoDate(new Date());
  if (rule.noFuture && iso > today) return "오늘 이후 날짜는 입력할 수 없습니다.";
  if (rule.noPast && iso < today) return "오늘 이전 날짜는 입력할 수 없습니다.";
  if (rule.notBefore?.iso && iso < rule.notBefore.iso) {
    return `${rule.notBefore.label}(${formatKDate(rule.notBefore.iso)})보다 빠를 수 없습니다.`;
  }
  return null;
}
