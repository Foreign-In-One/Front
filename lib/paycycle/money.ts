/** Shared KRW display: preserve cents and confirmed zero; never turn null into zero. */
export function formatKrw(
  value: number | null,
  locale: string,
  unavailable = '—',
): string {
  return value === null
    ? unavailable
    : new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 2,
      }).format(value);
}
