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

/**
 * Returns the absolute value of a decimal string. Used at the display layer
 * to convert "spending" (which arrives as a negative debit total from the
 * analytics aggregator) into a positive number for UI presentation. Operates
 * purely on the string so no float coercion happens.
 */
export function absDecimalString(value: string): string {
  const str = String(value);
  return str.startsWith('-') ? str.slice(1) : str;
}

function parseScaled(s: string, scale: number): bigint {
  // Defensive coerce: a misconfigured backend that emits BigDecimal as a JSON
  // number (Jackson's default — fixed in our services via JacksonConfig but
  // worth guarding against on the client too) would arrive here as a JS
  // `number`. String() preserves the value losslessly enough for typical
  // money amounts and prevents the UI from crashing on contract drift.
  const str = String(s);
  const negative = str.startsWith('-');
  const body = negative ? str.slice(1) : str;
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
