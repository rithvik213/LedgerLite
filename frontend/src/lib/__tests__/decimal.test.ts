import { sumDecimalStrings } from '../decimal';

describe('sumDecimalStrings', () => {
  it('returns "0.0000" for empty input', () => {
    expect(sumDecimalStrings([])).toBe('0.0000');
  });

  it('sums two simple values', () => {
    expect(sumDecimalStrings(['150.0000', '75.5000'])).toBe('225.5000');
  });

  it('handles fractional carry without rounding error', () => {
    // 0.0001 + 0.0002 = 0.0003 — would be 0.00030000000000000003 in float
    expect(sumDecimalStrings(['0.0001', '0.0002'])).toBe('0.0003');
  });

  it('handles negative values (debits) correctly', () => {
    expect(sumDecimalStrings(['-50.0000', '100.0000'])).toBe('50.0000');
    expect(sumDecimalStrings(['-100.0000', '50.0000'])).toBe('-50.0000');
  });

  it('preserves precision past Number.MAX_SAFE_INTEGER', () => {
    // Number sum of these would lose precision; BigInt path keeps it exact
    expect(sumDecimalStrings(['12345678901234.5000', '0.5000'])).toBe('12345678901235.0000');
  });

  it('respects a custom scale', () => {
    expect(sumDecimalStrings(['1.23', '4.56'], 2)).toBe('5.79');
  });

  it('treats integers as zero-fractional', () => {
    expect(sumDecimalStrings(['100', '50'])).toBe('150.0000');
  });
});
