import './pinia';
import { defineStore } from 'pinia';
import type {
  AuthTokensDto,
  LoginRequestDto,
  MeResponseDto,
  RegisterRequestDto,
  RegisterResponseDto,
} from '@social/shared';
import { http } from '@/lib/http';
import { clearTokens, getAccessToken, isAuthenticated, setTokens } from '@/lib/auth';

interface AuthState {
  user: MeResponseDto | null;
  ready: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    // false tant que restoreSession() n'a pas tenté de recharger le profil
    // au démarrage de l'app (évite un flash "non connecté" au reload).
    ready: false,
  }),
  getters: {
    isAuthenticated: (): boolean => isAuthenticated(),
  },
  actions: {
    async login(payload: LoginRequestDto): Promise<void> {
      const tokens = await http.post<AuthTokensDto>('/auth/login', payload, { skipAuth: true });
      setTokens(tokens);
      await this.fetchMe();
    },

    async join(payload: RegisterRequestDto): Promise<void> {
      await http.post<RegisterResponseDto>('/auth/register', payload, { skipAuth: true });
      await this.login({ displayName: payload.displayName, password: payload.password });
    },

    async fetchMe(): Promise<void> {
      this.user = await http.get<MeResponseDto>('/me');
    },

    // Recharge le profil depuis un token déjà en storage (démarrage de l'app /
    // rechargement de page). Si le token est mort (refresh aussi invalide),
    // on nettoie et l'utilisateur retombe sur /login via la garde de navigation.
    async restoreSession(): Promise<void> {
      if (!getAccessToken()) {
        this.ready = true;
        return;
      }
      try {
        await this.fetchMe();
      } catch {
        clearTokens();
        this.user = null;
      } finally {
        this.ready = true;
      }
    },

    async logout(): Promise<void> {
      try {
        await http.post('/auth/logout');
      } catch {
        // Rien à faire : les tokens sont de toute façon supprimés côté client ci-dessous.
      } finally {
        clearTokens();
        this.user = null;
      }
    },
  },
});
