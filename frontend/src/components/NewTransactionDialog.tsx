import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './ui/toast';
import { transactionSchema, type TransactionFormValues } from '../lib/schemas/transaction';
import { newIdempotencyKey } from '../lib/idempotency';
import { useCreateTransaction } from '../hooks/useTransactions';
import type { AccountResponse } from '../types/account';

const PRESET_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Housing',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Income',
  'Transfer',
  'Other',
];

interface Props {
  accounts: AccountResponse[];
  /** Pre-select this account when the dialog opens */
  defaultAccountId?: string;
}

interface ToastState {
  open: boolean;
  title: string;
  description?: string;
  variant: 'default' | 'destructive';
}

export function NewTransactionDialog({ accounts, defaultAccountId }: Props) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    title: '',
    variant: 'default',
  });

  // The idempotency key is generated exactly once per dialog-open cycle, in
  // the effect below. While the dialog is closed it stays null. Within an open
  // session the key is stable across re-renders and across submit retries
  // (e.g., a 5xx retry intentionally reuses the same key — that's the whole
  // point of idempotency). A new key is minted on every fresh open.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIdempotencyKey(newIdempotencyKey());
      setSubmitError(null);
    }
  }, [open]);

  const mutation = useCreateTransaction();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      accountId: defaultAccountId ?? '',
      amount: '',
      category: '',
      description: '',
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      setSubmitError(null);
    }
  }

  async function onSubmit(values: TransactionFormValues) {
    // The form is mounted inside <Dialog open={open}>, so submit can only fire
    // when open is true, which means the effect above has already populated
    // idempotencyKey. The non-null assertion documents that invariant.
    if (idempotencyKey === null) return;
    setSubmitError(null);
    try {
      await mutation.mutateAsync({
        data: {
          accountId: values.accountId,
          amount: values.amount,
          category: values.category,
          description: values.description || undefined,
        },
        idempotencyKey,
      });
      setOpen(false);
      reset();
      setToast({
        open: true,
        title: 'Transaction created',
        description: `${values.amount} posted successfully.`,
        variant: 'default',
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 409) {
          setSubmitError('Account changed elsewhere, please refresh and try again');
        } else if (status !== undefined && status >= 500) {
          setSubmitError('Service degraded, please try again shortly');
        } else {
          // Don't echo the backend's response body — the `message` / `detail`
          // fields can contain reflected user input (RFC 7807 validation
          // errors). Show a fixed string instead. Field-level validation
          // belongs in the schema layer, which already runs before submit.
          setSubmitError('Request could not be completed. Please check your input and try again.');
        }
      } else {
        setSubmitError('Unexpected error');
      }
    }
  }

  const isPending = isSubmitting || mutation.isPending;

  return (
    <ToastProvider>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button>New Transaction</Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 py-2">
            {/* Account */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-account">Account</Label>
              <Controller
                name="accountId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="tx-account" aria-invalid={Boolean(errors.accountId)}>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.accountId && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.accountId.message}
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Amount</Label>
              <Input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                placeholder="-50.00 for a debit, 1200.00 for income"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'tx-amount-error' : undefined}
                {...register('amount')}
              />
              {errors.amount && (
                <p id="tx-amount-error" role="alert" className="text-xs text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-category">Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="tx-category" aria-invalid={Boolean(errors.category)}>
                      <SelectValue placeholder="Select or type a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-description">Description (optional)</Label>
              <Input
                id="tx-description"
                type="text"
                placeholder="What was this for?"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'tx-desc-error' : undefined}
                {...register('description')}
              />
              {errors.description && (
                <p id="tx-desc-error" role="alert" className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* API-level error (409, 5xx, etc.) */}
            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isPending} aria-busy={isPending}>
                {isPending ? 'Submitting…' : 'Submit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toast
        open={toast.open}
        onOpenChange={(o) => setToast((t) => ({ ...t, open: o }))}
        variant={toast.variant}
        duration={4000}
      >
        <ToastTitle>{toast.title}</ToastTitle>
        {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
