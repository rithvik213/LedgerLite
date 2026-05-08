import { describe, expect, it } from 'vitest';
import { newAccountSchema } from '../account';

describe('newAccountSchema', () => {
  it('accepts a valid payload', () => {
    const result = newAccountSchema.safeParse({
      name: 'My Checking',
      type: 'CHECKING',
      currency: 'USD',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = newAccountSchema.safeParse({ name: '', type: 'SAVINGS', currency: 'USD' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name');
    }
  });

  it('rejects a name longer than 100 characters', () => {
    const result = newAccountSchema.safeParse({
      name: 'a'.repeat(101),
      type: 'CHECKING',
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid account type', () => {
    const result = newAccountSchema.safeParse({ name: 'Acct', type: 'INVALID', currency: 'USD' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed currency code', () => {
    const result = newAccountSchema.safeParse({ name: 'Acct', type: 'CREDIT', currency: 'us' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('currency');
    }
  });

  it('defaults currency to USD when omitted', () => {
    const result = newAccountSchema.safeParse({ name: 'Acct', type: 'SAVINGS' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
    }
  });

  it('accepts EUR as a valid currency', () => {
    const result = newAccountSchema.safeParse({ name: 'Euro Savings', type: 'SAVINGS', currency: 'EUR' });
    expect(result.success).toBe(true);
  });
});
