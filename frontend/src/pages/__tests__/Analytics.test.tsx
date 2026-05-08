import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '../Analytics';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../api/analytics', () => ({
  getSpendingByCategory: vi.fn(),
  getSpending: vi.fn(),
}));

vi.mock('../../api/accounts', () => ({
  listAccounts: vi.fn(),
}));

// Stub chart components so jsdom's missing ResizeObserver doesn't crash the test.
// The Analytics page test validates query/state logic; visual output is covered
// by CategoryDonut.test.tsx and SpendingBarChart.test.tsx which mock recharts directly.
vi.mock('../../components/CategoryDonut', () => ({
  CategoryDonut: ({ data }: { data: { category: string }[] }) => (
    <div data-testid="category-donut" data-count={data.length} />
  ),
}));

vi.mock('../../components/SpendingBarChart', () => ({
  SpendingBarChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="spending-bar-chart" data-count={data.length} />
  ),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { getSpendingByCategory } from '../../api/analytics';
import { listAccounts } from '../../api/accounts';
import type { SpendingResponse } from '../../types/analytics';

const mockGetSpendingByCategory = vi.mocked(getSpendingByCategory);
const mockListAccounts = vi.mocked(listAccounts);

const MOCK_SPENDING: SpendingResponse[] = [
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'FOOD',
    totalAmount: '-150.0000',
    transactionCount: 3,
  },
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'TRANSPORT',
    totalAmount: '-75.5000',
    transactionCount: 2,
  },
];

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderAnalytics() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <Analytics />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Analytics page', () => {
  beforeEach(() => {
    mockListAccounts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    // Never resolves — keeps the component in loading state
    mockGetSpendingByCategory.mockReturnValue(new Promise(() => {}));
    renderAnalytics();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders both charts when data is returned', async () => {
    mockGetSpendingByCategory.mockResolvedValue(MOCK_SPENDING);
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByTestId('category-donut')).toBeInTheDocument();
      expect(screen.getByTestId('spending-bar-chart')).toBeInTheDocument();
    });
  });

  it('shows empty state when API returns an empty array', async () => {
    mockGetSpendingByCategory.mockResolvedValue([]);
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByText('No spending data for this month.')).toBeInTheDocument();
    });
  });

  it('shows error state with a retry button on failure', async () => {
    mockGetSpendingByCategory.mockRejectedValue(new Error('network error'));
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('clicking retry triggers a refetch', async () => {
    const user = userEvent.setup();
    mockGetSpendingByCategory
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue(MOCK_SPENDING);

    renderAnalytics();
    await waitFor(() => screen.getByRole('alert'));

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('category-donut')).toBeInTheDocument();
    });
  });

  it('displays the correct total spending sum', async () => {
    mockGetSpendingByCategory.mockResolvedValue(MOCK_SPENDING);
    renderAnalytics();
    // 150.0000 + 75.5000 = 225.50
    await waitFor(() => {
      expect(screen.getByText(/\$225\.50/)).toBeInTheDocument();
    });
  });

  it('refetches with new month when MonthPicker changes', async () => {
    const user = userEvent.setup();
    mockGetSpendingByCategory.mockResolvedValue(MOCK_SPENDING);
    renderAnalytics();

    await waitFor(() => expect(mockGetSpendingByCategory).toHaveBeenCalledTimes(1));

    const input = screen.getByLabelText('Select month');
    await user.clear(input);
    await user.type(input, '2025-03');

    await waitFor(() => {
      expect(mockGetSpendingByCategory).toHaveBeenCalledTimes(2);
    });
  });
});
