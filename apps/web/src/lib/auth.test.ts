import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clearTokens, getAccessToken, getRefreshToken, isAuthenticated, setTokens } from './auth';

describe('lib/auth token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reports not authenticated when no token is stored', () => {
    expect(isAuthenticated()).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('stores both tokens and reports authenticated', () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    expect(isAuthenticated()).toBe(true);
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('keeps the existing refresh token when only an access token is set', () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    setTokens({ accessToken: 'access-2' });

    expect(getAccessToken()).toBe('access-2');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('clears both tokens', () => {
    setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    clearTokens();

    expect(isAuthenticated()).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
