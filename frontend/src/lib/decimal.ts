/**
 * Sums an array of decimal strings without converting to floating-point.
 *
 * Each input is parsed as a scaled BigInt (integer "ten-thousandths" by
 * default, matching the backend's `NUMERIC(19,4)` column), summed, then
 * formatted back to a string. Float coercion via `Number()` / `parseFloat`
 * is precision-lossy past ~15 significant digits and accumulates error per
 * addition — exactly the kind of drift that's invisible in tests with
 * round numbers and surfaces only on real account totals. Keep money out
 * of doubles end to end.
 *
 * Inputs must match `/^-?\d+(\.\d+)?$/`. Fractional digits beyond `scale`
 * are truncated; the backend never emits more than 4 here.
 */
export function sumDecimalStrings(values: string[], scale = 4): string {
  let total = 0n;
  for (const v of values) {
    total += parseScaled(v, scale);
  }
  return formatScaled(total, scale);
}

function parseScaled(s: string, scale: number): bigint {
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const [intPart, fracPart = ''] = body.split('.');
  const padded = fracPart.padEnd(scale, '0').slice(0, scale);
  const result = BigInt(intPart + padded);
  return negative ? -result : result;
}

function formatScaled(scaled: bigint, scale: number): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const str = abs.toString().padStart(scale + 1, '0');
  const intPart = str.slice(0, -scale);
  const fracPart = str.slice(-scale);
  return `${negative ? '-' : ''}${intPart}.${fracPart}`;
}
