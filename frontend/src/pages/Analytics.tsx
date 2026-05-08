import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';
import { listAccounts } from '../api/accounts';
import { useSpendingByCategory } from '../hooks/useSpending';
import { MonthPicker } from '../components/MonthPicker';
import { CategoryDonut } from '../components/CategoryDonut';
import { SpendingBarChart } from '../components/SpendingBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';
import { formatCurrency } from '../lib/format';
import { sumDecimalStrings, absDecimalString } from '../lib/decimal';

function currentYearMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function Analytics() {
  const [month, setMonth] = useState(currentYearMonth);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
    staleTime: 30_000,
  });

  const {
    data: spendingData,
    isLoading,
    isError,
    refetch,
  } = useSpendingByCategory(month, accountId);

  // The analytics aggregator stores per-category sums for ALL transactions
  // (debits and credits). "Spending" semantically means debits only — income
  // categories like a paycheck would otherwise inflate the total and mix
  // into the "spending by category" charts. Filter to negative-amount rows.
  const debitRows = (spendingData ?? []).filter((row) => row.totalAmount.startsWith('-'));
  const total =
    debitRows.length > 0
      ? absDecimalString(sumDecimalStrings(debitRows.map((row) => row.totalAmount)))
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex flex-wrap items-end gap-3 ml-auto">
          {/* Account filter */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="account-filter"
              className="text-sm font-medium leading-none"
            >
              Account
            </label>
            <Select
              value={accountId ?? 'all'}
              onValueChange={(v) => setAccountId(v === 'all' ? undefined : v)}
            >
              <SelectTrigger id="account-filter" className="w-44" aria-label="Filter by account">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {(accountsQuery.data ?? []).map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {/* Total spending summary */}
      {total !== null && !isLoading && !isError && (
        <p className="text-sm text-muted-foreground">
          Total spending:{' '}
          <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading spending data"
          className="flex h-64 items-center justify-center text-sm text-muted-foreground"
        >
          Loading...
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-8"
        >
          <p className="text-sm text-destructive">Failed to load spending data.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state — true when there's no debit activity to chart, even if
          income exists, since the charts and total are spending-only. */}
      {!isLoading && !isError && debitRows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <PieChart size={40} className="text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No spending data for this month.</p>
        </div>
      )}

      {/* Charts — rendered side-by-side on md+, stacked on mobile */}
      {!isLoading && !isError && debitRows.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Category (Donut)</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryDonut data={debitRows} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Category (Bar)</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingBarChart data={debitRows} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
