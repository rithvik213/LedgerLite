import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Accounts } from '../Accounts';
import type { AccountResponse } from '../../types/account';

vi.mock('../../api/accounts');

import * as accountsApi from '../../api/accounts';

const mockAccounts: AccountResponse[] = [
  {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Main Checking',
    type: 'CHECKING',
    balance: '1500.0000',
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'acc-2',
    userId: 'user-1',
    name: 'Emergency Savings',
    type: 'SAVINGS',
    balance: '5000.0000',
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderAccounts(client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Accounts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Accounts page', () => {
  it('renders loading skeleton while query is pending', () => {
    vi.mocked(accountsApi.listAccounts).mockReturnValue(new Promise(() => {}));
    renderAccounts();
    expect(screen.getByLabelText(/loading accounts/i)).toBeInTheDocument();
  });

  it('renders a card for each account once data loads', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue(mockAccounts);
    renderAccounts();
    expect(await screen.findByText('Main Checking')).toBeInTheDocument();
    expect(screen.getByText('Emergency Savings')).toBeInTheDocument();
  });

  it('shows empty state when list is empty', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    renderAccounts();
    expect(await screen.findByText(/create your first account/i)).toBeInTheDocument();
  });

  it('shows error state when query fails', async () => {
    vi.mocked(accountsApi.listAccounts).mockRejectedValue(new Error('Network error'));
    renderAccounts();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load accounts/i)).toBeInTheDocument();
  });

  it('"New Account" button opens the dialog', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue(mockAccounts);
    const user = userEvent.setup();
    renderAccounts();
    // Wait for data so the button is rendered
    await screen.findByText('Main Checking');
    await user.click(screen.getByRole('button', { name: /new account/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
