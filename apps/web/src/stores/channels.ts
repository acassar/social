import './pinia';
import { defineStore } from 'pinia';
import type { ChannelDto } from '@social/shared';
import { http } from '@/lib/http';

interface ChannelsState {
  groupId: string | null;
  channels: ChannelDto[];
  loading: boolean;
  error: string | null;
}

// Un seul group actif en MVP (voir doc/SPEC.md §1) : la sidebar liste les
// salons de ce group unique, triés par position, sans notion de multi-group
// à sélectionner.
export const useChannelsStore = defineStore('channels', {
  state: (): ChannelsState => ({
    groupId: null,
    channels: [],
    loading: false,
    error: null,
  }),
  getters: {
    sortedChannels: (state): ChannelDto[] =>
      [...state.channels].sort((a, b) => a.position - b.position),
  },
  actions: {
    async fetchChannels(groupId: string): Promise<void> {
      this.groupId = groupId;
      this.loading = true;
      this.error = null;
      try {
        this.channels = await http.get<ChannelDto[]>(`/groups/${groupId}/channels`);
      } catch {
        this.error = 'Impossible de charger les salons.';
      } finally {
        this.loading = false;
      }
    },
  },
});
