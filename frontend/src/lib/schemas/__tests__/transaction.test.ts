import { describe, expect, it } from 'vitest';
import { transactionSchema } from '../transaction';

const base = { accountId: 'acc-1', amount: '50.00', category: 'Food & Dining' };

describe('transactionSchema', () => {
  describe('amount', () => {
    it('accepts a positive integer string', () => {
      expect(transactionSchema.safeParse({ ...base, amount: '100' }).success).toBe(true);
    });

    it('accepts a positive decimal string', () => {
      expect(transactionSchema.safeParse({ ...base, amount: '99.99' }).success).toBe(true);
    });

    it('accepts a negative decimal (debit)', () => {
      expect(transactionSchema.safeParse({ ...base, amount: '-42.50' }).success).toBe(true);
    });

    it('accepts up to 4 decimal places', () => {
      expect(transactionSchema.safeParse({ ...base, amount: '1.1234' }).success).toBe(true);
    });

    it('rejects more than 4 decimal places', () => {
      const result = transactionSchema.safeParse({ ...base, amount: '1.12345' });
      expect(result.success).toBe(false);
    });

    it('rejects zero', () => {
      const result = transactionSchema.safeParse({ ...base, amount: '0' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/zero/i);
      }
    });

    it('rejects non-numeric strings', () => {
      const result = transactionSchema.safeParse({ ...base, amount: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = transactionSchema.safeParse({ ...base, amount: '' });
      expect(result.success).toBe(false);
    });

    it('rejects a value with letters mixed in', () => {
      const result = transactionSchema.safeParse({ ...base, amount: '10a.5' });
      expect(result.success).toBe(false);
    });
  });

  describe('required fields', () => {
    it('rejects missing accountId', () => {
      const result = transactionSchema.safeParse({ ...base, accountId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing category', () => {
      const result = transactionSchema.safeParse({ ...base, category: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('description', () => {
    it('is optional', () => {
      const { description: _, ...noDesc } = { ...base, description: undefined };
      expect(transactionSchema.safeParse(noDesc).success).toBe(true);
    });

    it('rejects description longer than 255 characters', () => {
      const result = transactionSchema.safeParse({ ...base, description: 'x'.repeat(256) });
      expect(result.success).toBe(false);
    });

    it('accepts description of exactly 255 characters', () => {
      expect(
        transactionSchema.safeParse({ ...base, description: 'x'.repeat(255) }).success,
      ).toBe(true);
    });
  });
});
