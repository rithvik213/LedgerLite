import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountDetail } from '../AccountDetail';
import type { AccountResponse } from '../../types/account';
import type { TransactionResponse } from '../../types/transaction';

vi.mock('../../api/accounts');
vi.mock('../../api/transactions');

import * as accountsApi from '../../api/accounts';
import * as transactionsApi from '../../api/transactions';

const mockAccount: AccountResponse = {
  id: 'acc-1',
  userId: 'user-1',
  name: 'Main Checking',
  type: 'CHECKING',
  balance: '2500.7500',
  currency: 'USD',
  version: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-15T12:00:00Z',
};

const mockTransactions: TransactionResponse[] = [
  {
    id: 'tx-1',
    accountId: 'acc-1',
    userId: 'user-1',
    amount: '-42.0000',
    category: 'FOOD',
    description: 'Coffee shop',
    idempotencyKey: 'ik-1',
    status: 'POSTED',
    failureReason: null,
    reversesTransactionId: null,
    createdAt: '2024-06-10T09:00:00Z',
  },
];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDetail(accountId = 'acc-1', client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/accounts/${accountId}`]}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetail />} />
          <Route path="/accounts" element={<div>Accounts list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AccountDetail page', () => {
  it('renders account header with formatted balance', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue([]);
    renderDetail();
    expect(await screen.findByText('Main Checking')).toBeInTheDocument();
    // Intl formats 2500.75 as $2,500.75
    expect(screen.getByText(/2,500\.75/)).toBeInTheDocument();
  });

  it('shows 404 state when API returns 404', async () => {
    const notFoundError = Object.assign(new Error('Not found'), {
      response: { status: 404 },
    });
    vi.mocked(accountsApi.getAccount).mockRejectedValue(notFoundError);
    renderDetail('missing-id');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/account not found/i)).toBeInTheDocument();
  });

  it('back button navigates to /accounts', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue([]);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Main Checking');
    await user.click(screen.getByRole('button', { name: /back to accounts/i }));
    expect(await screen.findByText('Accounts list')).toBeInTheDocument();
  });

  // ── Transactions section ────────────────────────────────────────────────────

  it('renders the transactions table when data loads', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue(mockTransactions);
    renderDetail();
    await screen.findByText('Main Checking');
    expect(await screen.findByText('Coffee shop')).toBeInTheDocument();
  });

  it('shows loading skeleton for transactions while fetching', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    // Never resolves — keeps the component in transaction-loading state
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(new Promise(() => {}));
    renderDetail();
    await screen.findByText('Main Checking');
    expect(screen.getByLabelText(/loading transactions/i)).toBeInTheDocument();
  });

  it('shows empty state when account has no transactions', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue([]);
    renderDetail();
    await screen.findByText('Main Checking');
    await waitFor(() => {
      expect(
        screen.getByText(/no transactions yet for this account/i),
      ).toBeInTheDocument();
    });
  });

  it('shows error state with retry button when transactions fetch fails', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    vi.mocked(transactionsApi.listTransactions).mockRejectedValue(
      new Error('network error'),
    );
    renderDetail();
    await screen.findByText('Main Checking');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('fetches transactions for the correct account id', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue(mockTransactions);
    renderDetail('acc-1');
    await screen.findByText('Main Checking');
    await waitFor(() => {
      expect(transactionsApi.listTransactions).toHaveBeenCalledWith('acc-1');
    });
  });
});
