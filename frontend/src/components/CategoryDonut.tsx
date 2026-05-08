import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import type { SpendingResponse } from '../types/analytics';
import { formatCurrency } from '../lib/format';

// Deterministic color assignment keyed by category name.
// Using a fixed palette avoids color flicker when data order changes.
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
  data: SpendingResponse[];
}

/**
 * Donut chart showing spending broken down by category.
 *
 * totalAmount stays as string throughout; Number() is applied only inside
 * the chart layer for Recharts, which requires numeric values. Precision loss
 * is bounded to display rendering — the string is never fed back into
 * arithmetic or sent to the API.
 */
export function CategoryDonut({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No spending data for this period.
      </div>
    );
  }

  const chartData = data.map((row) => ({
    name: row.category,
    // Display-only conversion — see JSDoc above. Math.abs because the analytics
    // aggregator stores debits as negative; donut slices are sized by magnitude.
    value: Math.abs(Number(row.totalAmount)),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={75}
          outerRadius={115}
          paddingAngle={2}
          dataKey="value"
          label={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={colorForCategory(entry.name)} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(String(value)),
            name,
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

