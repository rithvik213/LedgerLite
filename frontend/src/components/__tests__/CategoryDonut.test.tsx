import { render, screen } from '@testing-library/react';
import { CategoryDonut } from '../CategoryDonut';
import type { SpendingResponse } from '../../types/analytics';

// jsdom doesn't implement ResizeObserver, which Recharts' ResponsiveContainer requires.
// We stub the entire recharts module so tests focus on our component logic and data
// mapping, not on Recharts internals.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <svg data-testid="pie-chart">{children}</svg>
    ),
    Pie: ({ data }: { data: { name: string }[] }) => (
      <>
        {data.map((d) => (
          <path key={d.name} data-testid={`pie-slice-${d.name}`} />
        ))}
      </>
    ),
    Cell: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

const MOCK_DATA: SpendingResponse[] = [
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'FOOD',
    totalAmount: '150.0000',
    transactionCount: 3,
  },
  {
    userId: 'u1',
    accountId: 'a1',
    yearMonth: '2025-01',
    category: 'TRANSPORT',
    totalAmount: '75.5000',
    transactionCount: 2,
  },
];

describe('CategoryDonut', () => {
  it('renders without crashing with valid data', () => {
    render(<CategoryDonut data={MOCK_DATA} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('renders a pie slice per data entry', () => {
    render(<CategoryDonut data={MOCK_DATA} />);
    MOCK_DATA.forEach((row) => {
      expect(screen.getByTestId(`pie-slice-${row.category}`)).toBeInTheDocument();
    });
  });

  it('shows empty state when data is empty', () => {
    render(<CategoryDonut data={[]} />);
    expect(screen.getByText('No spending data for this period.')).toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });
});
