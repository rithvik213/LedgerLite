import { Wallet } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  subtitle: string;
}

/**
 * Shared wrapper for Login and Register — gradient background, brand mark,
 * centered card slot.
 */
export function AuthLayout({ children, subtitle }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-[hsl(var(--accent)/0.06)] px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
            <Wallet size={24} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LedgerLite</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {/* Card slot — focus-within adds a subtle accent ring */}
        <div className="rounded-xl border bg-card shadow-md transition-shadow focus-within:shadow-lg focus-within:ring-1 focus-within:ring-[hsl(var(--accent)/0.4)]">
          {children}
        </div>
      </div>
    </main>
  );
}
