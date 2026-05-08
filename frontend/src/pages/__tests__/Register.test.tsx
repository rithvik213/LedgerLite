import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Register } from '../Register';
import type { UserResponse } from '../../types/auth';

// --- API mocks ---
const mockRegister = vi.fn<(data: { email: string; password: string }) => Promise<UserResponse>>();

vi.mock('../../api/auth', () => ({
  register: (data: { email: string; password: string }) => mockRegister(data),
  login: vi.fn(),
  getMe: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const stubUser: UserResponse = {
  id: 'user-2',
  email: 'new@example.com',
  roles: 'USER',
  createdAt: '2024-01-01T00:00:00Z',
};

function renderRegister() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/register']}>
        <Register />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Register page', () => {
  it('renders email, password fields and submit button', () => {
    renderRegister();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows a validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/email/i), 'bad-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows a validation error for password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'tiny');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('calls register() with form values on valid submit', async () => {
    mockRegister.mockResolvedValue(stubUser);

    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securepass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({ email: 'new@example.com', password: 'securepass' }),
    );
  });

  it('navigates to /login on success and does not auto-login', async () => {
    mockRegister.mockResolvedValue(stubUser);

    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securepass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { registered: true } }),
    );
  });

  it('displays the error detail message on API error', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { data: { detail: 'Email already registered.' } },
    };
    mockRegister.mockRejectedValue(axiosError);

    const axiosMod = await import('axios');
    vi.spyOn(axiosMod.default, 'isAxiosError').mockReturnValue(true);

    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securepass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Email already registered.')).toBeInTheDocument();
  });
});
