import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { RotateCcw } from 'lucide-react';
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
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './ui/toast';
import { newIdempotencyKey } from '../lib/idempotency';
import { useReverseTransaction } from '../hooks/useTransactions';
import type { TransactionResponse } from '../types/transaction';

interface Props {
  transaction: TransactionResponse;
  /** Called after any outcome that should trigger a list refetch (409, 404). */
  onRefetch?: () => void;
  /** Called after a successful reversal with the new reversal row. */
  onSuccess?: (reversal: TransactionResponse) => void;
}

interface ToastState {
  open: boolean;
  title: string;
  description?: string;
  variant: 'default' | 'destructive';
  /** Optional action shown as a small button in the toast. */
  action?: { label: string; onClick: () => void };
}

export function ReverseTransactionDialog({ transaction, onRefetch, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, title: '', variant: 'default' });

  // The idempotency key is stable for the lifetime of one dialog-open session.
  // Generated in an effect (not useState initializer) to avoid StrictMode
  // double-render producing two different keys — the second would silently
  // replace the first, making retry with the same key impossible.
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      idempotencyKeyRef.current = newIdempotencyKey();
      setReason('');
      setSubmitError(null);
    }
  }, [open]);

  const mutation = useReverseTransaction();

  async function handleConfirm() {
    if (!idempotencyKeyRef.current) return;
    setSubmitError(null);

    try {
      const result = await mutation.mutateAsync({
        transactionId: transaction.id,
        accountId: transaction.accountId,
        body: reason.trim() ? { reason: reason.trim() } : {},
        idempotencyKey: idempotencyKeyRef.current,
      });

      setOpen(false);
      onSuccess?.(result.data);

      // 200 = idempotent replay (this key was already used) — silent success.
      // 201 = freshly created reversal.
      if (!result.alreadyApplied) {
        setToast({
          open: true,
          title: 'Reversal posted',
          description: 'A reversal entry has been appended to your ledger.',
          variant: 'default',
        });
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;

        if (status === 409) {
          setOpen(false);
          onRefetch?.();
          setToast({
            open: true,
            title: 'Already reversed',
            description: 'This transaction has already been reversed.',
            variant: 'destructive',
          });
        } else if (status === 422) {
          setOpen(false);
          setToast({
            open: true,
            title: "Can't reverse",
            description: "This transaction can't be reversed.",
            variant: 'destructive',
          });
        } else if (status === 404) {
          setOpen(false);
          onRefetch?.();
          setToast({
            open: true,
            title: 'Transaction not found',
            variant: 'destructive',
          });
        } else if (status === 503) {
          // Do NOT consume the idempotency key on 503 — the backend never wrote
          // a row, so the key is still "fresh". We surface the error inline so
          // the user can close the dialog (which mints a new key on next open)
          // and retry. Closing is intentionally the retry mechanism.
          setSubmitError('Account service unavailable. Close and try again.');
        } else {
          setSubmitError('Unexpected error. Please try again.');
        }
      } else {
        setSubmitError('Unexpected error. Please try again.');
      }
    }
  }

  const isPending = mutation.isPending;

  return (
    <ToastProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Reverse transaction ${transaction.id}`}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reverse
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse this transaction?</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-sm text-muted-foreground">
            <p>
              This appends a reversal entry to your ledger. The original entry remains visible.
              Both will show in your transaction history.
            </p>

            <div className="grid gap-1.5">
              <Label htmlFor="reversal-reason">Reason (optional)</Label>
              <Input
                id="reversal-reason"
                type="text"
                placeholder="e.g. Duplicate charge, data entry error"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={255}
              />
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? 'Reversing…' : 'Confirm reversal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast
        open={toast.open}
        onOpenChange={(o) => setToast((t) => ({ ...t, open: o }))}
        variant={toast.variant}
        duration={5000}
      >
        <div className="flex-1">
          <ToastTitle>{toast.title}</ToastTitle>
          {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
        </div>
        {toast.action && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              toast.action?.onClick();
              setToast((t) => ({ ...t, open: false }));
            }}
          >
            {toast.action.label}
          </Button>
        )}
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
