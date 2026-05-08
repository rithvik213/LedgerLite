import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../Dashboard';
import type { AccountResponse } from '../../types/account';
import type { TransactionResponse } from '../../types/transaction';
import type { SpendingResponse } from '../../types/analytics';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../api/accounts', () => ({
  listAccounts: vi.fn(),
}));

vi.mock('../../api/transactions', () => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock('../../api/analytics', () => ({
  getSpendingByCategory: vi.fn(),
  getSpending: vi.fn(),
}));

// Stub recharts to avoid ResizeObserver noise in jsdom. The chart component
// itself is tested in CategoryDonut.test.tsx; here we just need to confirm it
// renders with data.
vi.mock('../../components/CategoryDonut', () => ({
  CategoryDonut: ({ data }: { data: SpendingResponse[] }) => (
    <div data-testid="category-donut" data-count={data.length} />
  ),
}));

// Spy on formatCurrency so we can verify the exact decimal string passed into it.
// This lets us assert BigInt-correct arithmetic without depending on Intl output.
vi.mock('../../lib/format', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/format')>();
  return {
    ...original,
    formatCurrency: vi.fn(original.formatCurrency),
  };
});

// ── Imports after mocks ───────────────────────────────────────────────────────

import { listAccounts } from '../../api/accounts';
import { listTransactions } from '../../api/transactions';
import { getSpendingByCategory } from '../../api/analytics';
import { formatCurrency } from '../../lib/format';

const mockListAccounts = vi.mocked(listAccounts);
const mockListTransactions = vi.mocked(listTransactions);
const mockGetSpendingByCategory = vi.mocked(getSpendingByCategory);
const mockFormatCurrency = vi.mocked(formatCurrency);

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Values past Number.MAX_SAFE_INTEGER (9007199254740991).
// Float addition of these two would silently produce 18014398509481984;
// BigInt arithmetic produces 18014398509481986 — a difference of 2.
// We verify via the formatCurrency spy that sumDecimalStrings fed the correct
// string into the formatter, rather than relying on Intl output (which also
// loses precision because formatCurrency calls parseFloat internally — a
// documented limitation noted in format.ts).
const LARGE_AMOUNT_1 = '9007199254740993.0000';
const LARGE_AMOUNT_2 = '9007199254740993.0000';
const EXPECTED_SUM = '18014398509481986.0000';

const MOCK_ACCOUNTS: AccountResponse[] = [
  {
    id: 'acc-1',
    userId: 'u1',
    name: 'Checking',
    type: 'CHECKING',
    balance: LARGE_AMOUNT_1,
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    userId: 'u1',
    name: 'Savings',
    type: 'SAVINGS',
    balance: LARGE_AMOUNT_2,
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
];

const MOCK_TRANSACTIONS: TransactionResponse[] = [
  {
    id: 'tx-1',
    accountId: 'acc-1',
    userId: 'u1',
    amount: '-25.0000',
    category: 'FOOD',
    description: 'Grocery run',
    idempotencyKey: 'k1',
    status: 'POSTED',
    failureReason: null,
    createdAt: '2024-06-10T10:00:00Z',
  },
  {
    id: 'tx-2',
    accountId: 'acc-1',
    userId: 'u1',
    amount: '-10.0000',
    category: 'TRANSPORT',
    description: 'Bus pass',
    idempotencyKey: 'k2',
    status: 'POSTED',
    failureReason: null,
    createdAt: '2024-06-09T08:00:00Z',
  },
];

const MOCK_SPENDING: SpendingResponse[] = [
  {
    userId: 'u1',
    accountId: 'acc-1',
    yearMonth: '2024-06',
    category: 'FOOD',
    totalAmount: '-150.0000',
    transactionCount: 3,
  },
  {
    userId: 'u1',
    accountId: 'acc-1',
    yearMonth: '2024-06',
    category: 'TRANSPORT',
    totalAmount: '-75.5000',
    transactionCount: 2,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderDashboard(client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dashboard page', () => {
  beforeEach(() => {
    mockListTransactions.mockResolvedValue([]);
    mockGetSpendingByCategory.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while accounts are loading', () => {
    mockListAccounts.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByLabelText(/loading dashboard/i)).toBeInTheDocument();
  });

  it('shows error state when accounts query fails', async () => {
    mockListAccounts.mockRejectedValue(new Error('network error'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows empty state when user has no accounts', async () => {
    mockListAccounts.mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument();
    });
  });

  it('renders the total balance card using BigInt-correct sum', async () => {
    mockListAccounts.mockResolvedValue(MOCK_ACCOUNTS);
    renderDashboard();

    // Wait for accounts to be rendered (confirms the component is in the loaded state)
    await waitFor(() => {
      expect(screen.getByText('Checking')).toBeInTheDocument();
    });

    // Verify that formatCurrency was called with the BigInt-correct sum string.
    // Float addition of 9007199254740993 + 9007199254740993 silently gives
    // 18014398509481984 (rounding error). sumDecimalStrings gives 18014398509481986.
    // The spy confirms the correct string reaches the formatter.
    const allCalls = mockFormatCurrency.mock.calls.map((c) => c[0]);
    expect(allCalls).toContain(EXPECTED_SUM);
    expect(allCalls).not.toContain('18014398509481984.0000');
  });

  it('renders this-month spending card with correct sum', async () => {
    mockListAccounts.mockResolvedValue(MOCK_ACCOUNTS);
    mockGetSpendingByCategory.mockResolvedValue(MOCK_SPENDING);
    renderDashboard();

    // 150.0000 + 75.5000 = 225.50
    await waitFor(() => {
      expect(screen.getByText(/\$225\.50/)).toBeInTheDocument();
    });
  });

  it('renders recent transactions via TransactionTable', async () => {
    mockListAccounts.mockResolvedValue(MOCK_ACCOUNTS);
    mockListTransactions
      .mockResolvedValueOnce(MOCK_TRANSACTIONS) // acc-1
      .mockResolvedValue([]); // acc-2
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Grocery run')).toBeInTheDocument();
      expect(screen.getByText('Bus pass')).toBeInTheDocument();
    });
  });

  it('renders the CategoryDonut for the spending breakdown', async () => {
    mockListAccounts.mockResolvedValue(MOCK_ACCOUNTS);
    mockGetSpendingByCategory.mockResolvedValue(MOCK_SPENDING);
    renderDashboard();

    await waitFor(() => {
      const donut = screen.getByTestId('category-donut');
      expect(donut).toBeInTheDocument();
      expect(donut.getAttribute('data-count')).toBe('2');
    });
  });

  it('slices recent transactions to the 5 newest by createdAt desc', async () => {
    // Six transactions, increasing createdAt — descriptions tag the temporal order.
    const sixTransactions: TransactionResponse[] = Array.from({ length: 6 }, (_, i) => ({
      id: `tx-${i}`,
      accountId: 'acc-1',
      userId: 'u1',
      amount: '-5.0000',
      category: 'OTHER',
      description: `Transaction ${i}`,
      idempotencyKey: `k${i}`,
      status: 'POSTED' as const,
      failureReason: null,
      createdAt: new Date(2024, 5, i + 1).toISOString(),
    }));

    mockListAccounts.mockResolvedValue([MOCK_ACCOUNTS[0]]);
    mockListTransactions.mockResolvedValue(sixTransactions);
    renderDashboard();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // 1 header row + 5 data rows
      expect(rows).toHaveLength(6);
    });

    // Truncation: the oldest must be dropped — proves slice(0, 5) ran AFTER sort.
    expect(screen.queryByText('Transaction 0')).not.toBeInTheDocument();

    // Sort order: the newest (Transaction 5) must come first in the data rows.
    // If the sort direction silently flipped to ascending, the slice would keep
    // 0..4 instead of 5..1, and this assertion would fail.
    const dataRows = screen.getAllByRole('row').slice(1); // skip header
    expect(dataRows[0]).toHaveTextContent('Transaction 5');
  });

  it('shows transaction error state when transaction fetches fail', async () => {
    mockListAccounts.mockResolvedValue([MOCK_ACCOUNTS[0]]);
    mockListTransactions.mockRejectedValue(new Error('tx error'));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument();
    });
  });

  it('shows all four sections in the populated state', async () => {
    mockListAccounts.mockResolvedValue(MOCK_ACCOUNTS);
    // Per-account fixtures: MOCK_TRANSACTIONS is acc-1's data; acc-2 returns
    // empty. A single mockResolvedValue would echo the same rows for both
    // accounts and produce duplicate React keys — a real-bug-masking pattern
    // worth catching at the test layer.
    mockListTransactions.mockImplementation((accountId: string) => {
      return Promise.resolve(accountId === 'acc-1' ? MOCK_TRANSACTIONS : []);
    });
    mockGetSpendingByCategory.mockResolvedValue(MOCK_SPENDING);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/total balance/i)).toBeInTheDocument();
      expect(screen.getByText(/this month's spending/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /recent transactions/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /spending by category/i })).toBeInTheDocument();
    });
  });
});
