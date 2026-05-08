import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionTable } from '../TransactionTable';
import type { TransactionResponse } from '../../types/transaction';

function makeTransaction(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    id: 'tx-1',
    accountId: 'acc-1',
    userId: 'user-1',
    amount: '50.00',
    category: 'Food & Dining',
    description: 'Lunch',
    idempotencyKey: 'key-1',
    status: 'POSTED',
    failureReason: null,
    createdAt: '2024-03-15T12:00:00Z',
    ...overrides,
  };
}

describe('TransactionTable', () => {
  it('renders rows with formatted amounts', () => {
    const tx = makeTransaction({ amount: '75.50' });
    render(<TransactionTable transactions={[tx]} />);

    // formatCurrency('75.50') → '$75.50'
    expect(screen.getByText('$75.50')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();
  });

  it('applies negative-amount class for negative amounts', () => {
    const tx = makeTransaction({ amount: '-30.00' });
    render(<TransactionTable transactions={[tx]} />);

    const amountEl = screen.getByText('-$30.00');
    expect(amountEl).toHaveClass('negative-amount');
  });

  it('applies positive-amount class for positive amounts', () => {
    const tx = makeTransaction({ amount: '100.00' });
    render(<TransactionTable transactions={[tx]} />);

    const amountEl = screen.getByText('$100.00');
    expect(amountEl).toHaveClass('positive-amount');
  });

  it('renders status badge with POSTED styling', () => {
    render(<TransactionTable transactions={[makeTransaction({ status: 'POSTED' })]} />);
    const badge = screen.getByText('POSTED');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('renders status badge with PENDING styling', () => {
    render(<TransactionTable transactions={[makeTransaction({ status: 'PENDING' })]} />);
    const badge = screen.getByText('PENDING');
    expect(badge).toHaveClass('bg-yellow-100');
  });

  it('renders status badge with FAILED styling', () => {
    render(<TransactionTable transactions={[makeTransaction({ status: 'FAILED' })]} />);
    const badge = screen.getByText('FAILED');
    expect(badge).toHaveClass('bg-red-100');
  });

  it('shows empty state when no rows', () => {
    render(<TransactionTable transactions={[]} />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('renders multiple rows in descending date order', () => {
    const older = makeTransaction({
      id: 'tx-a',
      createdAt: '2024-01-01T10:00:00Z',
      description: 'Older',
    });
    const newer = makeTransaction({
      id: 'tx-b',
      createdAt: '2024-06-01T10:00:00Z',
      description: 'Newer',
    });
    render(<TransactionTable transactions={[older, newer]} />);

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row; rows[1] should be the newer tx
    expect(rows[1]).toHaveTextContent('Newer');
    expect(rows[2]).toHaveTextContent('Older');
  });
});
