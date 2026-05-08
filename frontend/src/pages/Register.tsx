import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { registerSchema, type RegisterFormValues } from '../lib/schemas/auth';
import { useRegisterMutation } from '../hooks/useAuthMutations';
import { CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { AuthLayout } from '../components/AuthLayout';

export function Register() {
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const mutation = useRegisterMutation();

  const apiError = mutation.error
    ? axios.isAxiosError(mutation.error) &&
      typeof mutation.error.response?.data?.detail === 'string'
      ? mutation.error.response.data.detail
      : 'Something went wrong.'
    : null;

  useEffect(() => {
    if (apiError && errorRef.current) {
      errorRef.current.focus();
    }
  }, [apiError]);

  return (
    <AuthLayout subtitle="Create your account">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Register</CardTitle>
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
              autoComplete="new-password"
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
            {mutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-[hsl(var(--accent))] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </AuthLayout>
  );
}
