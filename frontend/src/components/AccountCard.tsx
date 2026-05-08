import { useNavigate } from 'react-router-dom';
import { Building2, PiggyBank, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatCurrency } from '../lib/format';
import type { AccountResponse, AccountType } from '../types/account';

const TYPE_STYLES: Record<AccountType, string> = {
  CHECKING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SAVINGS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CREDIT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

const TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  CHECKING: <Building2 size={16} aria-hidden="true" />,
  SAVINGS: <PiggyBank size={16} aria-hidden="true" />,
  CREDIT: <CreditCard size={16} aria-hidden="true" />,
};

interface AccountCardProps {
  account: AccountResponse;
}

export function AccountCard({ account }: AccountCardProps) {
  const navigate = useNavigate();

  function handleClick() {
    navigate(`/accounts/${account.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/accounts/${account.id}`);
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${account.name} account, ${formatCurrency(account.balance, account.currency)}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">{account.name}</CardTitle>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[account.type]}`}
          >
            {TYPE_ICONS[account.type]}
            {account.type}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">
          {formatCurrency(account.balance, account.currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{account.currency}</p>
      </CardContent>
    </Card>
  );
}
