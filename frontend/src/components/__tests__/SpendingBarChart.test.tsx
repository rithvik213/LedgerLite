import { render, screen } from '@testing-library/react';
import { SpendingBarChart } from '../SpendingBarChart';
import type { SpendingResponse } from '../../types/analytics';

// jsdom doesn't implement ResizeObserver — stub recharts so tests focus on
// our data mapping and empty-state logic.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children }: { children: React.ReactNode; data?: unknown[] }) => (
      <svg data-testid="bar-chart">{children}</svg>
    ),
    Bar: ({ children }: { children?: React.ReactNode }) => <g>{children}</g>,
    Cell: ({ fill }: { fill?: string }) => <rect data-testid="bar-cell" fill={fill} />,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

const MOCK_DATA: SpendingResponse[] = [
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'FOOD',
    totalAmount: '200.0000',
    transactionCount: 4,
  },
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'HOUSING',
    totalAmount: '1200.0000',
    transactionCount: 1,
  },
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'ENTERTAINMENT',
    totalAmount: '50.0000',
    transactionCount: 2,
  },
];

describe('SpendingBarChart', () => {
  it('renders a bar chart SVG with data', () => {
    render(<SpendingBarChart data={MOCK_DATA} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders one Cell per data entry', () => {
    render(<SpendingBarChart data={MOCK_DATA} />);
    const cells = screen.getAllByTestId('bar-cell');
    expect(cells).toHaveLength(MOCK_DATA.length);
  });

  it('assigns deterministic colors per category', () => {
    render(<SpendingBarChart data={MOCK_DATA} />);
    const cells = screen.getAllByTestId('bar-cell');
    // Categories in MOCK_DATA: FOOD, HOUSING, ENTERTAINMENT — palette is
    // fixed in the component, so the colors must match exactly. A regression
    // that broke the palette mapping would change at least one of these.
    expect(cells[0].getAttribute('fill')).toBe('#6366f1'); // FOOD
    expect(cells[1].getAttribute('fill')).toBe('#10b981'); // HOUSING
    expect(cells[2].getAttribute('fill')).toBe('#ef4444'); // ENTERTAINMENT
  });

  it('shows empty state when data is empty', () => {
    render(<SpendingBarChart data={[]} />);
    expect(screen.getByText('No spending data for this period.')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });
});
