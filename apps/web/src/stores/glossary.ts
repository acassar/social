import './pinia';
import { defineStore } from 'pinia';
import type { GlossaryEntryDto, GlossaryPageDto, NativeLang } from '@social/shared';
import { http } from '@/lib/http';

interface GlossaryState {
  groupId: string | null;
  lang: NativeLang | null;
  searchText: string;
  entries: GlossaryEntryDto[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

function glossaryPath(
  groupId: string,
  filters: { lang: NativeLang | null; searchText: string },
  cursor?: string | null,
): string {
  const params = new URLSearchParams();
  if (filters.lang) {
    params.set('lang', filters.lang);
  }
  if (filters.searchText.trim()) {
    params.set('search', filters.searchText.trim());
  }
  if (cursor) {
    params.set('cursor', cursor);
  }
  const query = params.toString();
  return `/groups/${groupId}/glossary${query ? `?${query}` : ''}`;
}

// Glossaire (M4-T3) : vue dérivée en lecture des `word_entries` du group,
// filtrable par langue et recherchable sur term/translation
// (`GET /groups/:id/glossary`, voir doc/BACKLOG.md). Purement lecture, pas
// d'application d'événements socket : contrairement aux salons, le
// glossaire n'a pas de vue "active" à tenir à jour en direct.
export const useGlossaryStore = defineStore('glossary', {
  state: (): GlossaryState => ({
    groupId: null,
    lang: null,
    searchText: '',
    entries: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: null,
  }),
  actions: {
    async search(groupId: string, filters: { lang?: NativeLang | null; search?: string } = {}): Promise<void> {
      this.groupId = groupId;
      this.lang = filters.lang ?? null;
      this.searchText = filters.search ?? '';
      this.loading = true;
      this.error = null;
      try {
        const page = await http.get<GlossaryPageDto>(
          glossaryPath(groupId, { lang: this.lang, searchText: this.searchText }),
        );
        if (this.groupId !== groupId) {
          return;
        }
        this.entries = page.entries;
        this.nextCursor = page.nextCursor;
      } catch {
        this.error = 'Impossible de charger le glossaire.';
      } finally {
        this.loading = false;
      }
    },

    async loadMore(): Promise<void> {
      if (!this.groupId || !this.nextCursor || this.loadingMore) {
        return;
      }
      const groupId = this.groupId;
      this.loadingMore = true;
      try {
        const page = await http.get<GlossaryPageDto>(
          glossaryPath(groupId, { lang: this.lang, searchText: this.searchText }, this.nextCursor),
        );
        if (this.groupId !== groupId) {
          return;
        }
        const existingIds = new Set(this.entries.map((entry) => entry.id));
        this.entries.push(...page.entries.filter((entry) => !existingIds.has(entry.id)));
        this.nextCursor = page.nextCursor;
      } catch {
        this.error = 'Impossible de charger la suite du glossaire.';
      } finally {
        this.loadingMore = false;
      }
    },
  },
});
