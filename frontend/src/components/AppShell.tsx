import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../theme/useTheme';
import { Button } from './ui/button';
import type { Theme } from '../theme/ThemeProvider';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={16} aria-hidden="true" /> },
  { to: '/accounts', label: 'Accounts', icon: <Wallet size={16} aria-hidden="true" /> },
  { to: '/transactions', label: 'Transactions', icon: <ArrowLeftRight size={16} aria-hidden="true" /> },
  { to: '/analytics', label: 'Analytics', icon: <PieChart size={16} aria-hidden="true" /> },
];

// Cycles light → dark → system
function nextTheme(current: Theme): Theme {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'system';
  return 'light';
}

function themeAriaLabel(current: Theme): string {
  if (current === 'light') return 'Switch to dark mode';
  if (current === 'dark') return 'Switch to system theme';
  return 'Switch to light mode';
}

function ThemeIcon({ theme, resolved }: { theme: Theme; resolved: 'light' | 'dark' }) {
  if (theme === 'system') return <Monitor size={16} aria-hidden="true" />;
  if (resolved === 'dark') return <Moon size={16} aria-hidden="true" />;
  return <Sun size={16} aria-hidden="true" />;
}

export function AppShell() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, resolvedTheme, setTheme } = useTheme();

  function handleLogout() {
    clearAuth();
    // Drop cached server data so a subsequent login as a different user
    // never sees the previous user's accounts/transactions in flight.
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  function handleThemeToggle() {
    setTheme(nextTheme(theme));
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r bg-card px-3 py-6">
        {/* Brand */}
        <div className="mb-8 flex items-center gap-2 px-3">
          <Wallet size={20} className="text-[hsl(var(--accent))]" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight text-primary">LedgerLite</span>
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]'
                    : 'text-muted-foreground hover:bg-[hsl(var(--accent)/0.08)] hover:text-foreground',
                ].join(' ')
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <span />
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground" aria-label="Logged in as">
                {user.email}
              </span>
            )}
            <button
              onClick={handleThemeToggle}
              aria-label={themeAriaLabel(theme)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ThemeIcon theme={theme} resolved={resolvedTheme} />
            </button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
