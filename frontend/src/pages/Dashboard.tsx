import { useQueries } from '@tanstack/react-query';
import { Wallet, TrendingDown, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { AccountCard } from '../components/AccountCard';
import { TransactionTable } from '../components/TransactionTable';
import { CategoryDonut } from '../components/CategoryDonut';
import { useAccountsList } from '../hooks/useAccounts';
import { useSpendingByCategory } from '../hooks/useSpending';
import { listTransactions } from '../api/transactions';
import { transactionKeys } from '../hooks/useTransactions';
import { sumDecimalStrings, absDecimalString } from '../lib/decimal';
import { formatCurrency } from '../lib/format';
import type { TransactionResponse } from '../types/transaction';

/** Returns "YYYY-MM" for the current month. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Most common currency across accounts; falls back to "USD" on a tie or empty list. */
function dominantCurrency(balances: { currency: string }[]): string {
  const counts: Record<string, number> = {};
  for (const { currency } of balances) {
    counts[currency] = (counts[currency] ?? 0) + 1;
  }
  return (
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD'
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TotalBalanceCard({
  balances,
  currency,
}: {
  balances: string[];
  currency: string;
}) {
  const total = sumDecimalStrings(balances);
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Total Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold tabular-nums">
          {formatCurrency(total, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{currency}</p>
      </CardContent>
      {/* Accent icon — decorative */}
      <div className="absolute right-4 top-4 text-[hsl(var(--accent)/0.25)]">
        <Wallet size={40} aria-hidden="true" />
      </div>
    </Card>
  );
}

function SpendingCard({
  spending,
  currency,
  isLoading,
  isError,
}: {
  spending: string[];
  currency: string;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          This Month's Spending
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div
            className="h-10 w-32 animate-pulse rounded bg-muted"
            aria-hidden="true"
          />
        )}
        {isError && !isLoading && (
          <p className="text-sm text-destructive">Unable to load spending</p>
        )}
        {!isLoading && !isError && (
          <p className="text-4xl font-bold tabular-nums">
            {/* Spending arrives as negative debits from the analytics aggregator;
                show the magnitude so "this month's spending" reads naturally. */}
            {formatCurrency(absDecimalString(sumDecimalStrings(spending)), currency)}
          </p>
        )}
        {!isLoading && !isError && (
          <p className="mt-1 text-xs text-muted-foreground">{currency}</p>
        )}
      </CardContent>
      {/* Accent icon — decorative */}
      <div className="absolute right-4 top-4 text-[hsl(var(--accent)/0.25)]">
        <TrendingDown size={40} aria-hidden="true" />
      </div>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Dashboard() {
  const month = currentMonth();

  const {
    data: accounts = [],
    isLoading: accountsLoading,
    isError: accountsError,
  } = useAccountsList();

  const {
    data: spendingData = [],
    isLoading: spendingLoading,
    isError: spendingError,
  } = useSpendingByCategory(month);

  // Fetch transactions for every account in parallel so we can build a merged
  // recent-transactions list. useQueries is TanStack's built-in pattern for a
  // dynamic list of parallel queries — avoids a hook-count violation that would
  // arise from calling useTransactionsList in a loop.
  const txQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: transactionKeys.list(account.id),
      queryFn: () => listTransactions(account.id),
    })),
  });

  const txLoading = txQueries.some((q) => q.isLoading);
  const txError = txQueries.some((q) => q.isError);

  // TransactionTable owns the sort (date desc); we only merge + cap here.
  const recentTransactions: TransactionResponse[] = txQueries
    .flatMap((q) => q.data ?? [])
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const currency = dominantCurrency(accounts);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (accountsLoading) {
    return (
      <div
        className="flex flex-col gap-6"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-lg border bg-muted" aria-hidden="true" />
          <div className="h-28 animate-pulse rounded-lg border bg-muted" aria-hidden="true" />
        </div>
        <div className="h-48 animate-pulse rounded-lg border bg-muted" aria-hidden="true" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (accountsError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-16 text-center"
      >
        <p className="text-sm text-destructive">
          Failed to load dashboard data. Please refresh.
        </p>
      </div>
    );
  }

  // ── Empty state (no accounts yet) ───────────────────────────────────────────
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Wallet size={40} className="text-muted-foreground/40" aria-hidden="true" />
            <p className="font-medium">No accounts yet</p>
            <p className="text-sm text-muted-foreground">
              Create an account to see your financial summary here.
            </p>
            <Link
              to="/accounts"
              className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlusCircle size={15} aria-hidden="true" />
              Create your first account
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Populated dashboard ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Summary cards */}
      <section aria-label="Financial summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TotalBalanceCard balances={accounts.map((a) => a.balance)} currency={currency} />
        <SpendingCard
          spending={spendingData.map((s) => s.totalAmount)}
          currency={currency}
          isLoading={spendingLoading}
          isError={spendingError}
        />
      </section>

      {/* Accounts strip */}
      <section aria-label="Your accounts">
        <h2 className="mb-3 text-lg font-semibold">Accounts</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      </section>

      {/* Recent transactions + spending donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="recent-tx-heading"
          className="lg:col-span-2"
        >
          <h2 id="recent-tx-heading" className="mb-3 text-lg font-semibold">
            Recent Transactions
          </h2>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="pt-4">
              {txLoading && (
                <div
                  className="space-y-2 py-4"
                  aria-busy="true"
                  aria-label="Loading transactions"
                >
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded bg-muted"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}
              {txError && !txLoading && (
                <p
                  role="alert"
                  className="py-8 text-center text-sm text-destructive"
                >
                  Failed to load transactions.
                </p>
              )}
              {!txLoading && !txError && (
                <TransactionTable transactions={recentTransactions} />
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="spending-donut-heading">
          <h2 id="spending-donut-heading" className="mb-3 text-lg font-semibold">
            Spending by Category
          </h2>
          <Card>
            <CardContent className="pt-4">
              {spendingLoading && (
                <div
                  className="h-64 animate-pulse rounded bg-muted"
                  aria-hidden="true"
                />
              )}
              {!spendingLoading && (
                <CategoryDonut data={spendingData} />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
