import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NewAccountDialog } from '../NewAccountDialog';
import type { AccountResponse } from '../../types/account';

vi.mock('../../api/accounts');

import * as accountsApi from '../../api/accounts';

const mockCreated: AccountResponse = {
  id: 'acc-new',
  userId: 'user-1',
  name: 'Test Account',
  type: 'CHECKING',
  balance: '0.0000',
  currency: 'USD',
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

async function openDialog() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <NewAccountDialog />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: /new account/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  return user;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('NewAccountDialog', () => {
  it('renders form fields when dialog is open', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    await openDialog();
    expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
  });

  it('shows a validation error when name is empty on submit', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    const user = await openDialog();
    // Clear the name field and submit
    const nameInput = screen.getByLabelText(/account name/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/account name is required/i)).toBeInTheDocument();
  });

  it('type select exposes all three account types', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    await openDialog();
    // Radix Select renders a hidden native <select> for accessibility/form submission.
    // We assert against it because jsdom lacks pointer-capture APIs that Radix's
    // custom dropdown needs to open. The options being present in the native select
    // confirms the component is wired correctly.
    const nativeSelect = document.querySelector<HTMLSelectElement>('select[aria-hidden="true"]');
    expect(nativeSelect).not.toBeNull();
    const values = Array.from(nativeSelect!.options).map((o) => o.value);
    expect(values).toContain('CHECKING');
    expect(values).toContain('SAVINGS');
    expect(values).toContain('CREDIT');
  });

  it('calls createAccount with form values on valid submit', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    vi.mocked(accountsApi.createAccount).mockResolvedValue(mockCreated);
    const user = await openDialog();

    await user.clear(screen.getByLabelText(/account name/i));
    await user.type(screen.getByLabelText(/account name/i), 'Test Account');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(accountsApi.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Account', type: 'CHECKING', currency: 'USD' }),
      );
    });
  });

  it('closes the dialog on successful submission', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    vi.mocked(accountsApi.createAccount).mockResolvedValue(mockCreated);
    const user = await openDialog();

    await user.clear(screen.getByLabelText(/account name/i));
    await user.type(screen.getByLabelText(/account name/i), 'Test Account');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('displays server error message and keeps dialog open on failure', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
    vi.mocked(accountsApi.createAccount).mockRejectedValue(
      new Error('Account name already exists'),
    );
    const user = await openDialog();

    await user.clear(screen.getByLabelText(/account name/i));
    await user.type(screen.getByLabelText(/account name/i), 'Duplicate');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/account name already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
