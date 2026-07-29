const ACCESS_TOKEN_KEY = 'social:accessToken';

// Placeholder until M1-T4 wires a real Pinia auth store with token refresh.
export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
}
