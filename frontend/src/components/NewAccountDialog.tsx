import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useCreateAccount } from '../hooks/useAccounts';
import { ACCOUNT_TYPES, newAccountSchema, type NewAccountFormValues } from '../lib/schemas/account';

interface NewAccountDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function NewAccountDialog({ trigger, onSuccess }: NewAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { mutate, isPending } = useCreateAccount();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<NewAccountFormValues>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: { name: '', type: 'CHECKING', currency: 'USD' },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      setServerError(null);
    }
    setOpen(next);
  }

  function onSubmit(values: NewAccountFormValues) {
    setServerError(null);
    mutate(values, {
      onSuccess: () => {
        setOpen(false);
        reset();
        onSuccess?.();
      },
      onError: (err) => {
        // Surface the backend message if present; fall back to a generic string.
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to create account. Please try again.';
        setServerError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button>New Account</Button>}
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create new account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 py-2">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                autoComplete="off"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'account-name-error' : undefined}
                {...register('name')}
              />
              {errors.name && (
                <p id="account-name-error" role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-type">Account type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="account-type" aria-invalid={Boolean(errors.type)}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0) + t.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.type.message}
                </p>
              )}
            </div>

            {/* Currency */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-currency">Currency</Label>
              <Input
                id="account-currency"
                maxLength={3}
                placeholder="USD"
                aria-invalid={Boolean(errors.currency)}
                aria-describedby={errors.currency ? 'account-currency-error' : undefined}
                {...register('currency', {
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
              />
              {errors.currency && (
                <p id="account-currency-error" role="alert" className="text-sm text-destructive">
                  {errors.currency.message}
                </p>
              )}
            </div>

            {/* Server-side error */}
            {serverError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
