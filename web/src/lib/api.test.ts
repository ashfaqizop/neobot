import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setUnauthorizedHandler } from './api.ts';

function mockFetch(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(text),
    } as Response),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  setUnauthorizedHandler(null);
});

describe('api client', () => {
  it('parses JSON on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { needsSetup: true, supabaseConfigured: false, discordConfigured: false }));
    const status = await api.setupStatus();
    expect(status.needsSetup).toBe(true);
  });

  it('fires the unauthorized handler on 401 and throws ApiError', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal('fetch', mockFetch(401, { error: 'unauthorized' }));

    await expect(api.state()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not fire the handler for the login call itself (allowUnauthorized)', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal('fetch', mockFetch(401, { error: 'invalid_credentials' }));

    await expect(api.login('a', 'b')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('surfaces the backend error message', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { error: 'invalid_config' }));
    await expect(api.putConfig({} as never)).rejects.toMatchObject({
      status: 400,
      message: 'invalid_config',
    });
  });
});
