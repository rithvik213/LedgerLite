import { Wallet } from 'lucide-react';
import { AccountCard } from '../components/AccountCard';
import { NewAccountDialog } from '../components/NewAccountDialog';
import { useAccountsList } from '../hooks/useAccounts';

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading accounts"
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-lg border bg-muted"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function Accounts() {
  const { data: accounts, isLoading, isError, refetch } = useAccountsList();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <NewAccountDialog />
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
        >
          <p className="text-sm text-destructive">Failed to load accounts.</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && accounts?.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-16 text-center">
          <Wallet size={40} className="text-muted-foreground/40" aria-hidden="true" />
          <div>
            <p className="font-medium">No accounts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Get started by creating your first account.
            </p>
          </div>
          <NewAccountDialog
            trigger={
              <button className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Create your first account
              </button>
            }
          />
        </div>
      )}

      {!isLoading && !isError && accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
