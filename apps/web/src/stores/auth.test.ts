import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth';
import { clearTokens, getAccessToken, getRefreshToken } from '@/lib/auth';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('login stores tokens and loads the profile', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) {
        return jsonResponse({ accessToken: 'access-1', refreshToken: 'refresh-1' });
      }
      if (url.endsWith('/me')) {
        return jsonResponse({ id: 'u1', displayName: 'Alice', nativeLang: 'fr' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const store = useAuthStore();
    await store.login({ displayName: 'Alice', password: 'secret' });

    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(store.user).toEqual({ id: 'u1', displayName: 'Alice', nativeLang: 'fr' });
    expect(store.isAuthenticated).toBe(true);
  });

  it('join registers then logs in with the same credentials', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/register')) {
        return jsonResponse({ id: 'u1', displayName: 'Bob', nativeLang: 'de', groupId: 'g1' }, 201);
      }
      if (url.endsWith('/auth/login')) {
        return jsonResponse({ accessToken: 'access-1', refreshToken: 'refresh-1' });
      }
      if (url.endsWith('/me')) {
        return jsonResponse({ id: 'u1', displayName: 'Bob', nativeLang: 'de' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const store = useAuthStore();
    await store.join({
      inviteCode: 'abc123',
      displayName: 'Bob',
      nativeLang: 'de',
      password: 'secret',
    });

    expect(store.user?.displayName).toBe('Bob');
    expect(store.isAuthenticated).toBe(true);
  });

  it('restoreSession is a no-op without a stored token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const store = useAuthStore();
    await store.restoreSession();

    expect(store.ready).toBe(true);
    expect(store.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restoreSession loads the profile when a token is already stored', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ id: 'u1', displayName: 'Alice', nativeLang: 'fr' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const store = useAuthStore();
    localStorage.setItem('social:accessToken', 'access-1');
    await store.restoreSession();

    expect(store.ready).toBe(true);
    expect(store.user?.displayName).toBe('Alice');
  });

  it('restoreSession clears dead tokens when refresh also fails', async () => {
    localStorage.setItem('social:accessToken', 'expired');
    localStorage.setItem('social:refreshToken', 'also-expired');
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const store = useAuthStore();
    await store.restoreSession();

    expect(store.ready).toBe(true);
    expect(store.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('logout clears tokens and the profile even if the server call fails', async () => {
    setActivePinia(createPinia());
    localStorage.setItem('social:accessToken', 'access-1');
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const store = useAuthStore();
    await store.logout();

    expect(store.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    clearTokens();
  });
});
