import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { ReverseTransactionDialog } from '../ReverseTransactionDialog';
import { ToastProvider, ToastViewport } from '../ui/toast';
import type { TransactionResponse } from '../../types/transaction';

// --- module mocks -----------------------------------------------------------

vi.mock('../../api/transactions', () => ({
  reverseTransaction: vi.fn(),
  createTransaction: vi.fn(),
  listTransactions: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock('../../lib/idempotency', () => ({
  newIdempotencyKey: vi.fn(() => 'test-reversal-key'),
}));

import { reverseTransaction } from '../../api/transactions';
import { newIdempotencyKey } from '../../lib/idempotency';

// ---------------------------------------------------------------------------

const BASE_TX: TransactionResponse = {
  id: 'tx-original',
  accountId: 'acc-1',
  userId: 'user-1',
  amount: '-75.00',
  category: 'Food & Dining',
  description: 'Dinner',
  idempotencyKey: 'orig-key',
  status: 'POSTED',
  failureReason: null,
  createdAt: '2024-05-01T18:00:00Z',
  reversesTransactionId: null,
};

const REVERSAL_TX: TransactionResponse = {
  ...BASE_TX,
  id: 'tx-reversal',
  amount: '75.00',
  reversesTransactionId: 'tx-original',
  idempotencyKey: 'test-reversal-key',
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // ToastProvider lives at the app root in production (App.tsx); the test wrapper
  // mirrors that so the dialog's <Toast> children have a Radix context to attach to.
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        {children}
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  );
}

function renderDialog(props: Partial<React.ComponentProps<typeof ReverseTransactionDialog>> = {}) {
  const onRefetch = vi.fn();
  const onSuccess = vi.fn();
  render(
    <ReverseTransactionDialog
      transaction={BASE_TX}
      onRefetch={onRefetch}
      onSuccess={onSuccess}
      {...props}
    />,
    { wrapper },
  );
  return { onRefetch, onSuccess };
}

async function openDialog() {
  await userEvent.click(screen.getByRole('button', { name: /reverse transaction/i }));
}

// ---------------------------------------------------------------------------

describe('ReverseTransactionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(newIdempotencyKey).mockReturnValue('test-reversal-key');
  });

  it('renders the trigger button', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /reverse transaction/i })).toBeInTheDocument();
  });

  it('opens dialog with explanation text and confirm button', async () => {
    renderDialog();
    await openDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/appends a reversal entry/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm reversal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('generates idempotency key exactly once per dialog open', async () => {
    renderDialog();
    await openDialog();

    const callCountAfterOpen = vi.mocked(newIdempotencyKey).mock.calls.length;
    expect(callCountAfterOpen).toBe(1);

    // Typing should not regenerate the key
    await userEvent.type(screen.getByLabelText(/reason/i), 'test reason');
    expect(vi.mocked(newIdempotencyKey).mock.calls.length).toBe(1);
  });

  it('calls reverseTransaction with the idempotency key on confirm', async () => {
    vi.mocked(reverseTransaction).mockResolvedValue({ data: REVERSAL_TX, alreadyApplied: false });

    renderDialog();
    await openDialog();
    await userEvent.type(screen.getByLabelText(/reason/i), 'Duplicate charge');
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(reverseTransaction).toHaveBeenCalledWith(
        'tx-original',
        { reason: 'Duplicate charge' },
        'test-reversal-key',
      );
    });
  });

  it('calls reverseTransaction with empty body when no reason entered', async () => {
    vi.mocked(reverseTransaction).mockResolvedValue({ data: REVERSAL_TX, alreadyApplied: false });

    renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(reverseTransaction).toHaveBeenCalledWith(
        'tx-original',
        {},
        'test-reversal-key',
      );
    });
  });

  it('closes dialog and fires onSuccess after 201 success', async () => {
    vi.mocked(reverseTransaction).mockResolvedValue({ data: REVERSAL_TX, alreadyApplied: false });

    const { onSuccess } = renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalledWith(REVERSAL_TX);
  });

  it('treats 200 idempotent replay as success (no toast for duplicate)', async () => {
    vi.mocked(reverseTransaction).mockResolvedValue({ data: REVERSAL_TX, alreadyApplied: true });

    const { onSuccess } = renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalledWith(REVERSAL_TX);
    // The "Reversal posted" toast should NOT fire for idempotent replay
    expect(screen.queryByText(/reversal posted/i)).not.toBeInTheDocument();
  });

  it('shows already-reversed toast and calls onRefetch on 409', async () => {
    const conflictError = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409, data: {} },
    });
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    vi.mocked(reverseTransaction).mockRejectedValue(conflictError);

    const { onRefetch } = renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(screen.getByText(/already reversed/i)).toBeInTheDocument();
    });
    expect(onRefetch).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("shows can't-reverse toast on 422", async () => {
    const unprocessable = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: { status: 422, data: {} },
    });
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    vi.mocked(reverseTransaction).mockRejectedValue(unprocessable);

    renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(screen.getByText(/can't reverse/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows inline error on 503 and keeps dialog open for retry', async () => {
    const serviceUnavailable = Object.assign(new Error('Service Unavailable'), {
      isAxiosError: true,
      response: { status: 503, data: {} },
    });
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    vi.mocked(reverseTransaction).mockRejectedValue(serviceUnavailable);

    renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(screen.getByText(/account service unavailable/i)).toBeInTheDocument();
    });
    // Dialog stays open so the user can see the error and decide to cancel/retry
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows not-found toast and calls onRefetch on 404', async () => {
    const notFound = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404, data: {} },
    });
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    vi.mocked(reverseTransaction).mockRejectedValue(notFound);

    const { onRefetch } = renderDialog();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => {
      expect(screen.getByText(/transaction not found/i)).toBeInTheDocument();
    });
    expect(onRefetch).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reverse button visibility rules — tested through TransactionTable so we
// verify the conditional rendering logic is wired correctly.
// ---------------------------------------------------------------------------

import { TransactionTable } from '../TransactionTable';

describe('TransactionTable reverse button visibility', () => {
  function makeTransaction(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
    return {
      id: 'tx-1',
      accountId: 'acc-1',
      userId: 'user-1',
      amount: '-50.00',
      category: 'Food & Dining',
      description: 'Lunch',
      idempotencyKey: 'key-1',
      status: 'POSTED',
      failureReason: null,
      createdAt: '2024-03-15T12:00:00Z',
      reversesTransactionId: null,
      ...overrides,
    };
  }

  const onRefetch = vi.fn();

  it('shows Reverse button for a POSTED non-reversal row with no reversal sibling', () => {
    render(
      <TransactionTable transactions={[makeTransaction()]} onRefetch={onRefetch} />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: /reverse transaction/i })).toBeInTheDocument();
  });

  it('hides Reverse button for a PENDING row', () => {
    render(
      <TransactionTable
        transactions={[makeTransaction({ status: 'PENDING' })]}
        onRefetch={onRefetch}
      />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: /reverse transaction/i })).not.toBeInTheDocument();
  });

  it('hides Reverse button for a FAILED row', () => {
    render(
      <TransactionTable
        transactions={[makeTransaction({ status: 'FAILED' })]}
        onRefetch={onRefetch}
      />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: /reverse transaction/i })).not.toBeInTheDocument();
  });

  it('hides Reverse button for a reversal row itself', () => {
    render(
      <TransactionTable
        transactions={[makeTransaction({ id: 'tx-rev', reversesTransactionId: 'tx-orig' })]}
        onRefetch={onRefetch}
      />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: /reverse transaction/i })).not.toBeInTheDocument();
  });

  it('hides Reverse button on original when a reversal sibling exists in the list', () => {
    const original = makeTransaction({ id: 'tx-orig' });
    const reversal = makeTransaction({
      id: 'tx-rev',
      reversesTransactionId: 'tx-orig',
      amount: '50.00',
    });
    render(
      <TransactionTable transactions={[original, reversal]} onRefetch={onRefetch} />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: /reverse transaction/i })).not.toBeInTheDocument();
  });

  it('shows Reversed badge on an original that has a reversal sibling', () => {
    const original = makeTransaction({ id: 'tx-orig' });
    const reversal = makeTransaction({
      id: 'tx-rev',
      reversesTransactionId: 'tx-orig',
      amount: '50.00',
    });
    render(
      <TransactionTable transactions={[original, reversal]} onRefetch={onRefetch} />,
      { wrapper },
    );
    expect(screen.getByText('Reversed')).toBeInTheDocument();
  });

  it('shows Reversal badge on the reversal row', () => {
    const reversal = makeTransaction({
      id: 'tx-rev',
      reversesTransactionId: 'tx-orig',
      amount: '50.00',
    });
    render(
      <TransactionTable transactions={[reversal]} onRefetch={onRefetch} />,
      { wrapper },
    );
    expect(screen.getByText('Reversal')).toBeInTheDocument();
  });

  it('does not render the actions column when onRefetch is not provided', () => {
    render(
      <TransactionTable transactions={[makeTransaction()]} />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: /reverse transaction/i })).not.toBeInTheDocument();
  });
});
