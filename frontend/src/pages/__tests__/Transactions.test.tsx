import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Transactions } from '../Transactions';
import type { AccountResponse } from '../../types/account';
import type { TransactionResponse } from '../../types/transaction';

// --- module mocks -----------------------------------------------------------

vi.mock('../../api/accounts', () => ({
  listAccounts: vi.fn(),
}));

vi.mock('../../api/transactions', () => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock('../../lib/idempotency', () => ({
  newIdempotencyKey: vi.fn(() => 'mock-key'),
}));

import { listAccounts } from '../../api/accounts';
import { listTransactions } from '../../api/transactions';

// ---------------------------------------------------------------------------

const mockAccounts: AccountResponse[] = [
  {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Checking',
    type: 'CHECKING',
    balance: '500.0000',
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    userId: 'user-1',
    name: 'Savings',
    type: 'SAVINGS',
    balance: '2000.0000',
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTransactions: TransactionResponse[] = [
  {
    id: 'tx-1',
    accountId: 'acc-1',
    userId: 'user-1',
    amount: '-25.00',
    category: 'Food & Dining',
    description: 'Coffee',
    idempotencyKey: 'key-1',
    status: 'POSTED',
    failureReason: null,
    createdAt: '2024-06-01T10:00:00Z',
  },
  {
    id: 'tx-2',
    accountId: 'acc-1',
    userId: 'user-1',
    amount: '1000.00',
    category: 'Income',
    description: 'Paycheck',
    idempotencyKey: 'key-2',
    status: 'POSTED',
    failureReason: null,
    createdAt: '2024-06-02T10:00:00Z',
  },
];

function makeQc() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderPage() {
  const qc = makeQc();
  return render(
    <QueryClientProvider client={qc}>
      <Transactions />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------

describe('Transactions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAccounts).mockResolvedValue(mockAccounts);
  });

  it('renders a loading skeleton while transactions are fetching', async () => {
    // Never resolves — keeps the loading state visible
    vi.mocked(listTransactions).mockReturnValue(new Promise(() => {}));

    renderPage();

    // Select an account to trigger the transaction query
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /account/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByText('Checking'));

    expect(screen.getByRole('status', { name: /loading transactions/i })).toBeInTheDocument();
  });

  it('renders the transaction table when data resolves', async () => {
    vi.mocked(listTransactions).mockResolvedValue(mockTransactions);

    renderPage();

    await waitFor(() => screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByText('Checking'));

    await waitFor(() => {
      expect(screen.getByText('Coffee')).toBeInTheDocument();
      expect(screen.getByText('Paycheck')).toBeInTheDocument();
    });
  });

  it('shows empty state when account has no transactions', async () => {
    vi.mocked(listTransactions).mockResolvedValue([]);

    renderPage();

    await waitFor(() => screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByText('Checking'));

    await waitFor(() => {
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });
  });

  it('shows error state and retry button when API call fails', async () => {
    vi.mocked(listTransactions).mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByText('Checking'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('populates account filter Select from accounts query', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /account/i }));

    expect(screen.getByText('Checking')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
  });

  it('passes the selected account ID to listTransactions', async () => {
    vi.mocked(listTransactions).mockResolvedValue([]);

    renderPage();

    await waitFor(() => screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /account/i }));
    await userEvent.click(screen.getByText('Savings'));

    await waitFor(() => {
      expect(listTransactions).toHaveBeenCalledWith('acc-2');
    });
  });
});
