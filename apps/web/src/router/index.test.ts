import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { router } from './index';

describe('router', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('redirects the root path to /login', async () => {
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('redirects /app to /login when not authenticated', async () => {
    await router.push('/app');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('navigates to /app when authenticated', async () => {
    localStorage.setItem('social:accessToken', 'fake-token');

    await router.push('/app');
    expect(router.currentRoute.value.name).toBe('app');
  });

  it('navigates freely between login and app once authenticated', async () => {
    localStorage.setItem('social:accessToken', 'fake-token');

    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('login');

    await router.push('/app');
    expect(router.currentRoute.value.name).toBe('app');
  });
});
