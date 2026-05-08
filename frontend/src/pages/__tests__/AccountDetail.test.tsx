import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountDetail } from '../AccountDetail';
import type { AccountResponse } from '../../types/account';

vi.mock('../../api/accounts');

import * as accountsApi from '../../api/accounts';

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
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Main Checking');
    await user.click(screen.getByRole('button', { name: /back to accounts/i }));
    expect(await screen.findByText('Accounts list')).toBeInTheDocument();
  });

  it('renders the transactions placeholder section', async () => {
    vi.mocked(accountsApi.getAccount).mockResolvedValue(mockAccount);
    renderDetail();
    await screen.findByText('Main Checking');
    expect(screen.getByText(/transactions coming soon/i)).toBeInTheDocument();
  });
});
