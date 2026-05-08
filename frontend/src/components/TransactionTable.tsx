import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatCurrency, formatDate } from '../lib/format';
import { ReverseTransactionDialog } from './ReverseTransactionDialog';
import type { TransactionResponse, TransactionStatus } from '../types/transaction';

interface Props {
  transactions: TransactionResponse[];
  /** When provided, enables the Reverse action column. */
  onRefetch?: () => void;
}

// Light-mode bg classes kept for test assertions (toHaveClass checks them).
// Dark-mode overrides are additive via the dark: prefix.
const STATUS_CLASSES: Record<TransactionStatus, string> = {
  PENDING:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  POSTED:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  FAILED:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function StatusBadge({ status }: { status: TransactionStatus }) {
  return <span className={STATUS_CLASSES[status]}>{status}</span>;
}

function AmountCell({ amount }: { amount: string }) {
  const isNegative = amount.startsWith('-');
  return (
    <span
      className={
        isNegative
          ? 'font-medium text-red-600 dark:text-red-400 negative-amount'
          : 'font-medium text-green-600 dark:text-emerald-400 positive-amount'
      }
    >
      {formatCurrency(amount)}
    </span>
  );
}

/** Reversal row badge — shown on the reversal entry itself. */
function ReversalBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 reversal-badge">
      Reversal
    </span>
  );
}

/** Badge shown on an original transaction that has been reversed. */
function ReversedBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 reversed-badge">
      Reversed
    </span>
  );
}

/** Sorts descending by createdAt — newest first. */
function sortByDateDesc(transactions: TransactionResponse[]): TransactionResponse[] {
  return [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Derives which transaction IDs have been reversed by scanning the list for
 * reversal rows (rows where reversesTransactionId is non-null). Returns a Set
 * of the original transaction IDs that have at least one reversal row in the
 * current page. This is O(n) and runs client-side because the backend doesn't
 * return an "isReversed" flag — the reversal relationship is encoded in the
 * child row, not the parent.
 */
function buildReversedSet(transactions: TransactionResponse[]): Set<string> {
  const reversed = new Set<string>();
  for (const tx of transactions) {
    if (tx.reversesTransactionId !== null) {
      reversed.add(tx.reversesTransactionId);
    }
  }
  return reversed;
}

/**
 * Returns true when the Reverse action should be shown for a transaction.
 * Rules (all must hold):
 *   1. Status is POSTED
 *   2. Not a reversal row itself (reversesTransactionId is null)
 *   3. Not already reversed by another row in the current list
 */
function canReverse(tx: TransactionResponse, reversedIds: Set<string>): boolean {
  return (
    tx.status === 'POSTED' &&
    tx.reversesTransactionId === null &&
    !reversedIds.has(tx.id)
  );
}

export function TransactionTable({ transactions, onRefetch }: Props) {
  if (transactions.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center py-16 text-muted-foreground"
      >
        <p className="text-sm">No transactions yet</p>
      </div>
    );
  }

  const sorted = sortByDateDesc(transactions);
  const reversedIds = buildReversedSet(sorted);
  const showActions = onRefetch !== undefined;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Date</TableHead>
          <TableHead scope="col">Description</TableHead>
          <TableHead scope="col">Category</TableHead>
          <TableHead scope="col" className="text-right">
            Amount
          </TableHead>
          <TableHead scope="col">Status</TableHead>
          {showActions && <TableHead scope="col" className="w-24" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((tx) => {
          const isReversalRow = tx.reversesTransactionId !== null;
          const isReversed = reversedIds.has(tx.id);
          const showReverse = showActions && canReverse(tx, reversedIds);

          return (
            <TableRow
              key={tx.id}
              className={isReversalRow ? 'opacity-70' : undefined}
            >
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(tx.createdAt)}
              </TableCell>
              <TableCell className="max-w-xs text-sm">
                <span className={isReversalRow ? 'line-through text-muted-foreground' : undefined}>
                  {tx.description ?? <span className="italic text-muted-foreground">—</span>}
                </span>
              </TableCell>
              <TableCell className="text-sm">{tx.category ?? '—'}</TableCell>
              <TableCell className="text-right">
                <AmountCell amount={tx.amount} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <StatusBadge status={tx.status} />
                  {isReversalRow && <ReversalBadge />}
                  {isReversed && <ReversedBadge />}
                </div>
              </TableCell>
              {showActions && (
                <TableCell>
                  {showReverse && (
                    <ReverseTransactionDialog
                      transaction={tx}
                      onRefetch={onRefetch}
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
