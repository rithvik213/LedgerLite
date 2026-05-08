import { Label } from './ui/label';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  id?: string;
}

/**
 * Wraps the native month input in a labelled, accessible control.
 * Emits YYYY-MM strings directly — no date object conversion needed.
 */
export function MonthPicker({ value, onChange, id = 'month-picker' }: MonthPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Month</Label>
      <input
        id={id}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select month"
        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  );
}
