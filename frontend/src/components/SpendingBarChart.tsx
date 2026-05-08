import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { SpendingResponse } from '../types/analytics';
import { formatCurrency } from '../lib/format';

// Same palette as CategoryDonut for visual consistency across both charts.
const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#6366f1',
  TRANSPORT: '#f59e0b',
  HOUSING: '#10b981',
  ENTERTAINMENT: '#ef4444',
  HEALTH: '#3b82f6',
  UTILITIES: '#8b5cf6',
  SHOPPING: '#f97316',
  OTHER: '#6b7280',
};

function colorForCategory(category: string): string {
  return CATEGORY_COLORS[category.toUpperCase()] ?? '#6b7280';
}

interface Props {
  /**
   * Per-category spending for a single month.
   * X axis = category, Y axis = totalAmount.
   *
   * totalAmount is a decimal string from the backend (BigDecimal).
   * Number() is applied only inside this component for Recharts, which
   * requires numeric values. This is display-only — precision loss is bounded
   * for realistic personal-finance values (≤ ~10^13). The string type is
   * preserved everywhere outside the chart layer.
   */
  data: SpendingResponse[];
}

export function SpendingBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No spending data for this period.
      </div>
    );
  }

  const chartData = data.map((row) => ({
    category: row.category,
    // Display-only conversion — see JSDoc above. Math.abs because the analytics
    // aggregator stores debits as negative; we plot magnitudes so the bars rise
    // from a zero baseline rather than dropping below it.
    amount: Math.abs(Number(row.totalAmount)),
    totalAmount: row.totalAmount,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          // Values are now always >= 0 because amount goes through Math.abs above.
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(String(value)), 'Amount']}
          cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.category} fill={colorForCategory(entry.category)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
