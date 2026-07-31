import './pinia';
import { defineStore } from 'pinia';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@social/shared';
import { http } from '@/lib/http';
import { getAccessToken } from '@/lib/auth';

interface RealtimeState {
  socket: Socket | null;
  connected: boolean;
}

// Store minimal pour M2-T4 : connecte le socket au montage de l'app et
// journalise les événements reçus. Les modules M3+ (posts, réactions)
// consommeront ces événements pour mettre à jour leur propre état.
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

      for (const eventName of Object.values(REALTIME_EVENTS)) {
        socket.on(eventName, (payload: unknown) => {
          console.log(`[realtime] ${eventName}`, payload);
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
