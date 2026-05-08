import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCurrency, formatDate } from '../lib/format';
import { useAccount } from '../hooks/useAccounts';
import { useTransactionsList } from '../hooks/useTransactions';
import { TransactionTable } from '../components/TransactionTable';
import type { AccountType } from '../types/account';

const TYPE_STYLES: Record<AccountType, string> = {
  CHECKING: 'bg-blue-100 text-blue-800',
  SAVINGS: 'bg-green-100 text-green-800',
  CREDIT: 'bg-orange-100 text-orange-800',
};

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { status?: number } }).response?.status === 404
  );
}

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading, isError, error, refetch } = useAccount(id ?? '');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading account">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
        <div className="h-32 animate-pulse rounded-lg border bg-muted" aria-hidden="true" />
      </div>
    );
  }

  if (isError && isNotFoundError(error)) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-16 text-center"
      >
        <p className="text-lg font-semibold">Account not found</p>
        <p className="text-sm text-muted-foreground">
          This account doesn't exist or you don't have access to it.
        </p>
        <Button variant="outline" onClick={() => navigate('/accounts')}>
          Back to Accounts
        </Button>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-16 text-center">
        <p className="text-sm text-destructive">Failed to load account details.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => navigate('/accounts')}>
            Back to Accounts
          </Button>
        </div>
      </div>
    );
  }

  if (!account) return null;

  return (
    <AccountDetailContent id={account.id} account={account} onBack={() => navigate('/accounts')} />
  );
}

// Extracted so the transactions hook is only mounted once the account is confirmed loaded.
function AccountDetailContent({
  id,
  account,
  onBack,
}: {
  id: string;
  account: NonNullable<ReturnType<typeof useAccount>['data']>;
  onBack: () => void;
}) {
  const {
    data: transactions,
    isLoading: txLoading,
    isError: txError,
    refetch: txRefetch,
  } = useTransactionsList(id);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Back to accounts"
        >
          ← Back
        </Button>
      </div>

      {/* Account summary card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{account.name}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Updated {formatDate(account.updatedAt)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_STYLES[account.type]}`}
            >
              {account.type}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold tabular-nums">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{account.currency}</p>
        </CardContent>
      </Card>

      {/* Transactions section */}
      <section aria-labelledby="transactions-heading">
        <h2 id="transactions-heading" className="mb-3 text-lg font-semibold">
          Transactions
        </h2>
        <Card>
          <CardContent className="pt-4">
            {txLoading && (
              <div
                className="space-y-2 py-4"
                aria-busy="true"
                aria-label="Loading transactions"
              >
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded bg-muted"
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
            {txError && !txLoading && (
              <div
                role="alert"
                className="flex flex-col items-center gap-3 py-10 text-center"
              >
                <p className="text-sm text-destructive">
                  Failed to load transactions.
                </p>
                <Button variant="outline" size="sm" onClick={() => txRefetch()}>
                  Try again
                </Button>
              </div>
            )}
            {!txLoading && !txError && transactions !== undefined && (
              transactions.length === 0 ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-center justify-center py-16 text-muted-foreground"
                >
                  <p className="text-sm">No transactions yet for this account.</p>
                </div>
              ) : (
                <TransactionTable transactions={transactions} />
              )
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
