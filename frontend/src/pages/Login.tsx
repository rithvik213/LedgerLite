import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { loginSchema, type LoginFormValues } from '../lib/schemas/auth';
import { useLoginMutation } from '../hooks/useAuthMutations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

export function Login() {
  const location = useLocation();
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useLoginMutation();

  const apiError = mutation.error
    ? axios.isAxiosError(mutation.error) &&
      typeof mutation.error.response?.data?.detail === 'string'
      ? mutation.error.response.data.detail
      : 'Something went wrong.'
    : null;

  // Move focus to the error alert so screen reader users hear it immediately.
  useEffect(() => {
    if (apiError && errorRef.current) {
      errorRef.current.focus();
    }
  }, [apiError]);

  const justRegistered = (location.state as { registered?: boolean } | null)?.registered === true;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">LedgerLite</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Sign in</CardTitle>
            {justRegistered && (
              <CardDescription className="text-green-600">
                Account created — please sign in.
              </CardDescription>
            )}
          </CardHeader>

          <CardContent>
            {apiError && (
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none"
              >
                {apiError}
              </div>
            )}

            <form
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              noValidate
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                {errors.password && (
                  <p id="password-error" role="alert" className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
