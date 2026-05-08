import { z } from 'zod';

/**
 * Amount is submitted to the API as a decimal string (mirrors backend BigDecimal).
 * We accept negative values for debits.
 * Validation rules:
 *   - Required (non-empty)
 *   - Must parse as a finite number
 *   - No more than 4 decimal places (matches backend precision 19,4)
 *   - Zero is rejected — a zero-amount transaction has no effect
 */
const DECIMAL_PATTERN = /^-?\d+(\.\d{1,4})?$/;

export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => DECIMAL_PATTERN.test(v), {
      message: 'Enter a valid decimal (up to 4 decimal places)',
    })
    .refine((v) => parseFloat(v) !== 0, { message: 'Amount cannot be zero' }),
  category: z.string().min(1, 'Category is required'),
  description: z.string().max(255, 'Description must be 255 characters or fewer').optional(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
