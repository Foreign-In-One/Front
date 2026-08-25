/** 오늘 기준 D-day. 지난 날짜면 음수. */
export function dDay(dateValue: string): number {
  const target = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function addDays(dateValue: string, offset: number): string {
  const [y, m, d] = dateValue.split('-').map(Number);
  const date = new Date(y, m - 1, d + offset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 화면 표기는 항상 YYYY. MM. DD. */
export function formatKDate(dateValue: string): string {
  return dateValue ? `${dateValue.replaceAll('-', '. ')}.` : '';
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
