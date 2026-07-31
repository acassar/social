import type { AccessTokenDto } from '@social/shared';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface HttpRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip attaching the access token / attempting a refresh-on-401 (login, register, refresh itself). */
  skipAuth?: boolean;
}

async function rawFetch(path: string, options: HttpRequestOptions): Promise<Response> {
  const { body, headers, skipAuth, ...rest } = options;
  const authHeaders: HeadersInit = {};
  const token = !skipAuth ? getAccessToken() : null;
  if (token) {
    authHeaders.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let refreshInFlight: Promise<string | null> | null = null;

// Un seul refresh en vol à la fois, même si plusieurs requêtes prennent un 401 en même temps.
function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return Promise.resolve(null);
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await rawFetch('/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
          skipAuth: true,
        });
        if (!response.ok) {
          clearTokens();
          return null;
        }
        const data = (await response.json()) as AccessTokenDto;
        setTokens({ accessToken: data.accessToken });
        return data.accessToken;
      } catch {
        clearTokens();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: HttpRequestOptions = {},
  isRetry = false,
): Promise<T> {
  const response = await rawFetch(path, options);

  if (response.status === 401 && !options.skipAuth && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// Upload multipart (M5-T3, ex. POST /uploads) : pas de Content-Type explicite
// (le navigateur pose lui-même le boundary), sinon même comportement que
// `request` (Bearer token, retry sur 401 via refresh).
async function uploadRequest<T>(
  path: string,
  formData: FormData,
  isRetry = false,
): Promise<T> {
  const token = getAccessToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });

  if (response.status === 401 && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return uploadRequest<T>(path, formData, true);
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${path}`);
  }

  return (await response.json()) as T;
}

export const http = {
  baseUrl: API_URL,
  get: <T>(path: string, options?: HttpRequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: HttpRequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: HttpRequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: HttpRequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
};
