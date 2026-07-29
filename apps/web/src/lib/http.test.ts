import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { http } from './http';

describe('http client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
});
