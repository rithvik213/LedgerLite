import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAccounts } from '../api/accounts';
import { useTransactionsList } from '../hooks/useTransactions';
import { TransactionTable } from '../components/TransactionTable';
import { NewTransactionDialog } from '../components/NewTransactionDialog';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading transactions" className="p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mb-3 h-10 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

export function Transactions() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const txQuery = useTransactionsList(selectedAccountId || undefined);

  const accounts = accountsQuery.data ?? [];

  // Client-side date filtering — backend exposes no date-range params
  const filteredTransactions = (txQuery.data ?? []).filter((tx) => {
    if (fromDate && tx.createdAt < fromDate) return false;
    if (toDate && tx.createdAt > toDate + 'T23:59:59Z') return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <NewTransactionDialog
          accounts={accounts}
          defaultAccountId={selectedAccountId || undefined}
        />
      </div>

      {/* Filter bar */}
      <section aria-label="Filter transactions" className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="account-filter">Account</Label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger id="account-filter" className="w-52">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="from-date">From</Label>
          <Input
            id="from-date"
            type="date"
            className="w-40"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="to-date">To</Label>
          <Input
            id="to-date"
            type="date"
            className="w-40"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
          >
            Clear dates
          </Button>
        )}
      </section>

      {/* Content area */}
      <div className="rounded-lg border bg-card">
        {!selectedAccountId && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          >
            <p className="text-sm">Select an account to view transactions</p>
          </div>
        )}

        {selectedAccountId && txQuery.isLoading && <TableSkeleton />}

        {selectedAccountId && txQuery.isError && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-16 text-center text-sm"
          >
            <p className="text-destructive">Failed to load transactions.</p>
            <Button variant="outline" size="sm" onClick={() => txQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {selectedAccountId && txQuery.isSuccess && (
          <TransactionTable transactions={filteredTransactions} />
        )}
      </div>
    </div>
  );
}
