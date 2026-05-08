import { fireEvent, render, screen } from '@testing-library/react';
import { MonthPicker } from '../MonthPicker';

function currentYearMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

describe('MonthPicker', () => {
  it('renders with an accessible label', () => {
    render(<MonthPicker value="2025-01" onChange={() => {}} />);
    expect(screen.getByLabelText('Select month')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('default value prop reflects current month when passed currentYearMonth()', () => {
    const month = currentYearMonth();
    render(<MonthPicker value={month} onChange={() => {}} />);
    expect(screen.getByLabelText('Select month')).toHaveValue(month);
  });

  it('calls onChange with the YYYY-MM string the user picked', () => {
    const handleChange = vi.fn();
    render(<MonthPicker value="2025-01" onChange={handleChange} />);
    const input = screen.getByLabelText('Select month');
    // Native <input type="month"> emits the complete value on change — jsdom
    // doesn't simulate the picker UI, so fireEvent.change models the real
    // browser behavior more faithfully than userEvent.type.
    fireEvent.change(input, { target: { value: '2025-06' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('2025-06');
  });

  it('is keyboard focusable', () => {
    render(<MonthPicker value="2025-01" onChange={() => {}} />);
    const input = screen.getByLabelText('Select month');
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
