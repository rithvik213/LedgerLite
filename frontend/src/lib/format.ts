/**
 * Format a decimal string from the backend as a localised currency string.
 * We accept string (not number) because JavaScript's double-precision floats
 * cannot represent all 19-digit, 4-decimal-place values the backend may return.
 */
export function formatCurrency(
  value: string,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return value;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(parsed);
}

/** Format an ISO-8601 instant string as a short locale date. */
export function formatDate(iso: string, locale: string = 'en-US'): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/** Format an ISO-8601 instant string as a date + time. */
export function formatDateTime(iso: string, locale: string = 'en-US'): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
