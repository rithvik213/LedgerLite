import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { NewTransactionDialog } from '../NewTransactionDialog';
import type { AccountResponse } from '../../types/account';
import type { TransactionResponse } from '../../types/transaction';

// --- module mocks -----------------------------------------------------------

vi.mock('../../api/transactions', () => ({
  createTransaction: vi.fn(),
  listTransactions: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock('../../lib/idempotency', () => ({
  newIdempotencyKey: vi.fn(() => 'test-idempotency-key'),
}));

import { createTransaction } from '../../api/transactions';
import { newIdempotencyKey } from '../../lib/idempotency';

// ---------------------------------------------------------------------------

const mockAccounts: AccountResponse[] = [
  {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Checking',
    type: 'CHECKING',
    balance: '1000.0000',
    currency: 'USD',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTransaction: TransactionResponse = {
  id: 'tx-1',
  accountId: 'acc-1',
  userId: 'user-1',
  amount: '-50.00',
  category: 'Food & Dining',
  description: 'Lunch',
  idempotencyKey: 'test-idempotency-key',
  status: 'POSTED',
  failureReason: null,
  createdAt: '2024-03-15T12:00:00Z',
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function openDialog() {
  await userEvent.click(screen.getByRole('button', { name: /new transaction/i }));
}

function renderDialog(props: { accounts?: AccountResponse[] } = {}) {
  return render(
    <NewTransactionDialog accounts={props.accounts ?? mockAccounts} />,
    { wrapper },
  );
}

/**
 * Radix Select renders both a native <option> and a visible <span> with the same
 * text — use the span (role="option" or nearest visible element) to click.
 * The safest selector is getAllByText and pick the one inside the listbox.
 */
async function selectOption(comboboxName: RegExp, optionText: string) {
  await userEvent.click(screen.getByRole('combobox', { name: comboboxName }));
  // After opening, options render in the portal. Grab all matches and click
  // the one that is NOT an <option> element (i.e. the Radix-rendered span).
  const allMatches = screen.getAllByText(optionText);
  const visibleOption = allMatches.find((el) => el.tagName.toLowerCase() !== 'option');
  if (!visibleOption) throw new Error(`No visible option found with text: ${optionText}`);
  await userEvent.click(visibleOption);
}

// ---------------------------------------------------------------------------

describe('NewTransactionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(newIdempotencyKey).mockReturnValue('test-idempotency-key');
  });

  it('renders all form fields after opening', async () => {
    renderDialog();
    await openDialog();

    expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows validation errors for missing required fields on submit', async () => {
    renderDialog();
    await openDialog();

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/account is required/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
    });
  });

  it('generates the idempotency key once and keeps it stable across re-renders within a single open', async () => {
    renderDialog();
    await openDialog();

    // Key must be generated EXACTLY ONCE per dialog open — not on mount, not
    // on re-render. A regression to a useState initializer that calls
    // newIdempotencyKey() would push this count above 1 and fail.
    const callCountAfterOpen = vi.mocked(newIdempotencyKey).mock.calls.length;
    expect(callCountAfterOpen).toBe(1);

    // Trigger re-render by typing — key generation count must not increase.
    await userEvent.type(screen.getByLabelText(/amount/i), '5');
    expect(vi.mocked(newIdempotencyKey).mock.calls.length).toBe(1);
  });

  it('calls createTransaction with the form data and the explicit idempotency key', async () => {
    vi.mocked(createTransaction).mockResolvedValue(mockTransaction);

    renderDialog();
    await openDialog();

    await selectOption(/account/i, 'Checking (USD)');
    await userEvent.type(screen.getByLabelText(/amount/i), '-50.00');
    await selectOption(/category/i, 'Food & Dining');
    await userEvent.type(screen.getByLabelText(/description/i), 'Lunch');

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(createTransaction).toHaveBeenCalledWith(
        {
          accountId: 'acc-1',
          amount: '-50.00',
          category: 'Food & Dining',
          description: 'Lunch',
        },
        'test-idempotency-key',
      );
    });
  });

  it('shows "account changed" message on 409 Conflict', async () => {
    const conflictError = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409, data: {} },
    });
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    vi.mocked(createTransaction).mockRejectedValue(conflictError);

    renderDialog();
    await openDialog();

    await selectOption(/account/i, 'Checking (USD)');
    await userEvent.type(screen.getByLabelText(/amount/i), '10.00');
    await selectOption(/category/i, 'Other');

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/account changed elsewhere, please refresh and try again/i),
      ).toBeInTheDocument();
    });
  });

  it('shows "service degraded" message on 500 error', async () => {
    const serverError = Object.assign(new Error('Server Error'), {
      isAxiosError: true,
      response: { status: 500, data: {} },
    });
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    vi.mocked(createTransaction).mockRejectedValue(serverError);

    renderDialog();
    await openDialog();

    await selectOption(/account/i, 'Checking (USD)');
    await userEvent.type(screen.getByLabelText(/amount/i), '10.00');
    await selectOption(/category/i, 'Other');

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/service degraded, please try again shortly/i),
      ).toBeInTheDocument();
    });
  });

  it('closes the dialog on successful submission', async () => {
    vi.mocked(createTransaction).mockResolvedValue(mockTransaction);

    renderDialog();
    await openDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await selectOption(/account/i, 'Checking (USD)');
    await userEvent.type(screen.getByLabelText(/amount/i), '-50.00');
    await selectOption(/category/i, 'Food & Dining');

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
