import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from '../Login';
import { useAuthStore } from '../../auth/store';
import type { AuthResponse, UserResponse } from '../../types/auth';

// --- API mocks ---
const mockLogin = vi.fn<(data: { email: string; password: string }) => Promise<AuthResponse>>();
const mockApiGet = vi.fn();

vi.mock('../../api/auth', () => ({
  login: (data: { email: string; password: string }) => mockLogin(data),
  getMe: vi.fn(),
  register: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

// react-router-dom's useNavigate is provided by MemoryRouter in renders below.
// We capture it by spying on the module so we can assert navigation.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const stubUser: UserResponse = {
  id: 'user-1',
  email: 'user@example.com',
  roles: 'USER',
  createdAt: '2024-01-01T00:00:00Z',
};

const stubAuth: AuthResponse = {
  token: 'test-token',
  expiresAt: '2099-01-01T00:00:00Z',
};

function renderLogin(initialEntries: string[] = ['/login']) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset store to unauthenticated state before each test.
  useAuthStore.setState({ token: null, user: null });
});

describe('Login page', () => {
  it('renders email, password fields and submit button', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows a validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows a validation error for password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login() with form values on valid submit', async () => {
    mockLogin.mockResolvedValue(stubAuth);
    mockApiGet.mockResolvedValue({ data: stubUser });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123' }));
  });

  it('writes token and user to the store and navigates to / on success', async () => {
    mockLogin.mockResolvedValue(stubAuth);
    mockApiGet.mockResolvedValue({ data: stubUser });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Assert observable store state directly — more reliable than spying on
    // setAuth, which Zustand recreates per snapshot.
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(useAuthStore.getState().token).toBe(stubAuth.token);
    expect(useAuthStore.getState().user).toEqual(stubUser);
    // The /me call must have included the token explicitly so the store
    // never sees a token-without-user transient state.
    expect(mockApiGet).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: `Bearer ${stubAuth.token}` },
    });
  });

  it('displays the error detail on API error', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { data: { detail: 'Invalid credentials.' } },
    };
    mockLogin.mockRejectedValue(axiosError);

    // Patch axios.isAxiosError to recognise our stub. Use mockReturnValueOnce
    // so the mock auto-resets and cannot leak into subsequent tests.
    const axiosMod = await import('axios');
    vi.spyOn(axiosMod.default, 'isAxiosError').mockReturnValueOnce(true);

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials.')).toBeInTheDocument();
  });
});
