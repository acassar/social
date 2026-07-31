import './pinia';
import { defineStore } from 'pinia';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENTS, type RealtimeEventPayloadMap } from '@social/shared';
import { http } from '@/lib/http';
import { getAccessToken } from '@/lib/auth';
import { usePostsStore } from '@/stores/posts';

interface RealtimeState {
  socket: Socket | null;
  connected: boolean;
}

// Dispatch des événements post:*/reaction:* vers le salon texte affiché
// (stores/posts.ts), qui les applique sans jamais refetch (voir M3-T3).
function dispatchToStores(): {
  [Event in keyof RealtimeEventPayloadMap]?: (payload: RealtimeEventPayloadMap[Event]) => void;
} {
  const postsStore = usePostsStore();
  return {
    [REALTIME_EVENTS.POST_CREATED]: (event) => postsStore.handlePostCreated(event),
    [REALTIME_EVENTS.POST_UPDATED]: (event) => postsStore.handlePostUpdated(event),
    [REALTIME_EVENTS.POST_DELETED]: (event) => postsStore.handlePostDeleted(event),
    [REALTIME_EVENTS.REACTION_ADDED]: (event) => postsStore.handleReactionAdded(event),
    [REALTIME_EVENTS.REACTION_REMOVED]: (event) => postsStore.handleReactionRemoved(event),
  };
}

// Store minimal pour M2-T4 : connecte le socket au montage de l'app et
// journalise les événements reçus. Les modules M3+ (posts, réactions)
// consomment ces événements pour mettre à jour leur propre état (M3-T3).
export const useRealtimeStore = defineStore('realtime', {
  state: (): RealtimeState => ({
    socket: null,
    connected: false,
  }),
  actions: {
    connect(): void {
      if (this.socket) {
        return;
      }
      const token = getAccessToken();
      if (!token) {
        return;
      }

      const socket = io(http.baseUrl, { auth: { token } });

      socket.on('connect', () => {
        this.connected = true;
      });
      socket.on('disconnect', () => {
        this.connected = false;
      });

      const dispatchers: Partial<Record<string, (payload: never) => void>> = dispatchToStores();
      for (const eventName of Object.values(REALTIME_EVENTS)) {
        socket.on(eventName, (payload: unknown) => {
          console.log(`[realtime] ${eventName}`, payload);
          dispatchers[eventName]?.(payload as never);
        });
      }

      this.socket = socket;
    },

    disconnect(): void {
      this.socket?.disconnect();
      this.socket = null;
      this.connected = false;
    },
  },
});
