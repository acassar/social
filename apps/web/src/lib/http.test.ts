import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { http } from './http';
import { clearTokens, getAccessToken, setTokens } from './auth';

describe('http client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('reads the API base URL from the Vite env', () => {
    expect(http.baseUrl).toBe('http://localhost:3000');
  });

  it('performs a GET against baseUrl + path and decodes JSON', async () => {
    const result = await http.get<{ status: string }>('/health');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/health',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('serializes the body as JSON on POST', async () => {
    await http.post('/auth/login', { email: 'a@b.com' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com' }) }),
    );
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    await expect(http.get('/boom')).rejects.toThrow('HTTP 500');
  });

  it('attaches the stored access token as a Bearer header', async () => {
    setTokens({ accessToken: 'access-1' });

    await http.get('/me');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('does not attach a token when skipAuth is set', async () => {
    setTokens({ accessToken: 'access-1' });

    await http.post('/auth/login', { displayName: 'a', password: 'b' }, { skipAuth: true });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('refreshes the access token once on 401 and retries the original request', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'refresh-1' });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/me')) {
        const authorized =
          (init?.headers as Record<string, string> | undefined)?.Authorization ===
          'Bearer fresh-access';
        if (!authorized) {
          return new Response(null, { status: 401 });
        }
        return new Response(JSON.stringify({ id: '1' }), { status: 200 });
      }
      if (url.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ accessToken: 'fresh-access' }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await http.get<{ id: string }>('/me');

    expect(result).toEqual({ id: '1' });
    expect(getAccessToken()).toBe('fresh-access');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears tokens and throws when the refresh token is also invalid', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'also-expired' });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return new Response(null, { status: 401 });
      }
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(http.get('/me')).rejects.toThrow('HTTP 401');
    expect(getAccessToken()).toBeNull();

    clearTokens();
  });
});
