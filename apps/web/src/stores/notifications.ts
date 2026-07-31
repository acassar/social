import './pinia';
import { defineStore } from 'pinia';
import type { ChannelNotificationPreferenceDto } from '@social/shared';
import { http } from '@/lib/http';
import { ensurePushSubscribed, isPushSupported } from '@/lib/push';

interface NotificationsState {
  enabledByChannel: Record<string, boolean>;
  error: string | null;
}

// Opt-in par salon (M6-T2) : désactivé par défaut, jamais de relance forcée
// à activer. L'abonnement Push navigateur n'est demandé qu'au premier
// opt-in (voir lib/push.ts) ; désactiver un salon ne le révoque pas, il
// reste utile pour les autres salons opt-in.
export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    enabledByChannel: {},
    error: null,
  }),
  getters: {
    supported: () => isPushSupported(),
    isEnabled: (state) => (channelId: string) => state.enabledByChannel[channelId] ?? false,
  },
  actions: {
    async fetchPreference(channelId: string): Promise<void> {
      try {
        const pref = await http.get<ChannelNotificationPreferenceDto>(
          `/channels/${channelId}/notifications`,
        );
        this.enabledByChannel[channelId] = pref.enabled;
      } catch {
        // Best-effort : le toggle retombe sur "désactivé" (état par défaut).
      }
    },

    async enable(channelId: string): Promise<void> {
      this.error = null;
      try {
        await ensurePushSubscribed();
        await http.post<ChannelNotificationPreferenceDto>(`/channels/${channelId}/notifications`);
        this.enabledByChannel[channelId] = true;
      } catch {
        this.error = "Impossible d'activer les notifications sur ce salon.";
      }
    },

    async disable(channelId: string): Promise<void> {
      this.error = null;
      try {
        await http.delete<void>(`/channels/${channelId}/notifications`);
        this.enabledByChannel[channelId] = false;
      } catch {
        this.error = 'Impossible de désactiver les notifications sur ce salon.';
      }
    },
  },
});
