import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock the API module so the auth boot + login are deterministic (no fetch).
const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    me: vi.fn(),
    login: vi.fn(),
    state: vi.fn(),
  };
});

vi.mock('../lib/api.ts', () => ({
  ApiError: mocks.ApiError,
  setUnauthorizedHandler: vi.fn(),
  setAccessToken: vi.fn(),
  api: { me: mocks.me, login: mocks.login, state: mocks.state },
}));

import { AuthProvider } from '../lib/auth.tsx';
import { Login } from './Login.tsx';

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.me.mockRejectedValue(new mocks.ApiError(401, 'unauthorized'));
  });

  it('renders the login form', async () => {
    renderLogin();
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits credentials to the API', async () => {
    mocks.login.mockResolvedValue({ ok: true, username: 'admin' });
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'secret1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('admin', 'secret1'));
  });

  it('shows a distinct message on invalid credentials', async () => {
    mocks.login.mockRejectedValue(new mocks.ApiError(401, 'invalid_credentials'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/incorrect username or password/i)).toBeInTheDocument();
  });
});
