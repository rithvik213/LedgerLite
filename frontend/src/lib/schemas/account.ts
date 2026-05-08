import { z } from 'zod';

export const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CREDIT'] as const;

// ISO 4217 three-letter currency code — basic format check, not an exhaustive list.
// Backend validates the actual code; this prevents obviously malformed input.
const currencyCodeRegex = /^[A-Z]{3}$/;

export const newAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(100, 'Account name must be 100 characters or fewer')
    .trim(),
  type: z.enum(ACCOUNT_TYPES, {
    errorMap: () => ({ message: 'Select a valid account type' }),
  }),
  currency: z
    .string()
    .regex(currencyCodeRegex, 'Currency must be a 3-letter ISO 4217 code (e.g. USD)')
    .default('USD'),
});

export type NewAccountFormValues = z.infer<typeof newAccountSchema>;
