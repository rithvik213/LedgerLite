import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatCurrency, formatDate } from '../lib/format';
import type { TransactionResponse, TransactionStatus } from '../types/transaction';

interface Props {
  transactions: TransactionResponse[];
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
  const numeric = parseFloat(amount);
  const isNegative = numeric < 0;
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

/** Sorts descending by createdAt — newest first. */
function sortByDateDesc(transactions: TransactionResponse[]): TransactionResponse[] {
  return [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function TransactionTable({ transactions }: Props) {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
              {formatDate(tx.createdAt)}
            </TableCell>
            <TableCell className="max-w-xs truncate text-sm">
              {tx.description ?? <span className="text-muted-foreground italic">—</span>}
            </TableCell>
            <TableCell className="text-sm">{tx.category ?? '—'}</TableCell>
            <TableCell className="text-right">
              <AmountCell amount={tx.amount} />
            </TableCell>
            <TableCell>
              <StatusBadge status={tx.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
