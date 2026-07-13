/**
 * Login (masterdoc §8.2). Username/password against `POST /api/auth/login`.
 * Surfaces lockout (429) messaging distinctly from bad credentials, since the
 * backend rate-limits the login endpoint for brute-force protection.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { Brand } from '../components/Brand.tsx';
import { Button, Panel } from '../components/ui/primitives.tsx';
import { Field, Input } from '../components/ui/form.tsx';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many attempts — locked out briefly. Wait a moment and try again.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Incorrect username or password.');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base bg-grid px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Brand size={38} />
          <p className="text-sm text-muted">Sign in to your dashboard</p>
        </div>
        <Panel>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Username" htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password" error={error}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
