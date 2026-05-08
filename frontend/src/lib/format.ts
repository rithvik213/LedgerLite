/**
 * Format a decimal string from the backend as a localised currency string.
 * We accept string (not number) because JavaScript's double-precision floats
 * cannot represent all 19-digit, 4-decimal-place values the backend may return.
 *
 * Display-only precision caveat: parseFloat below rounds values that exceed
 * Number.MAX_SAFE_INTEGER's mantissa precision (~15 significant digits). For
 * realistic personal-finance balances (≤ ~$10^13) this is exact. If the app
 * ever needs to render large institutional balances, switch to a decimal lib
 * (decimal.js, big.js) — never use this output to round-trip into arithmetic.
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
