import './pinia';
import { defineStore } from 'pinia';
import type {
  CreateReactionRequestDto,
  CreateTextPostRequestDto,
  CreateWordEntryRequestDto,
  PostCreatedEvent,
  PostDeletedEvent,
  PostDto,
  PostUpdatedEvent,
  PostsPageDto,
  ReactionAddedEvent,
  ReactionDto,
  ReactionRemovedEvent,
  TextPostDto,
  WordEntryPostDto,
} from '@social/shared';
import { http } from '@/lib/http';
import { useAuthStore } from '@/stores/auth';

export function isTextPost(post: PostDto): post is TextPostDto {
  return post.type === 'text';
}

export function isWordEntryPost(post: PostDto): post is WordEntryPostDto {
  return post.type === 'word_of_day';
}

interface PostsState {
  channelId: string | null;
  // Un salon n'a qu'un seul type de post en pratique (déterminé par
  // `channel.type`, voir doc/SPEC.md §3) : le store reste générique sur
  // `PostDto`, chaque vue de salon (TextChannelView, WordChannelView, …)
  // se charge de restreindre son affichage au type qu'elle sait rendre via
  // `isTextPost`/`isWordEntryPost`.
  posts: PostDto[];
  reactionsByPost: Record<string, ReactionDto[]>;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

function postsPath(channelId: string, cursor?: string | null): string {
  if (!cursor) {
    return `/channels/${channelId}/posts`;
  }
  return `/channels/${channelId}/posts?cursor=${encodeURIComponent(cursor)}`;
}

// Store du salon `text` actif (M3-T3) : charge l'historique paginé de
// `GET /channels/:id/posts` et applique en direct les événements
// `post:*`/`reaction:*` reçus via le socket (voir stores/realtime.ts), sans
// jamais refetch. Un seul salon "actif" à la fois (celui affiché à l'écran).
//
// Note : le curseur de `GET /channels/:id/posts` (M3-T1) pagine en avant —
// la première page renvoie les messages les plus anciens, les pages
// suivantes les messages plus récents jusqu'à rattraper le direct. Il n'existe
// pas de curseur "avant" pour remonter au-delà du tout premier message :
// `loadMore()` charge donc la suite de l'historique, pas des messages plus
// anciens que ceux déjà affichés (voir la PR M3-T3 pour le détail).
export const usePostsStore = defineStore('posts', {
  state: (): PostsState => ({
    channelId: null,
    posts: [],
    reactionsByPost: {},
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: null,
  }),
  actions: {
    async loadChannel(channelId: string): Promise<void> {
      this.channelId = channelId;
      this.posts = [];
      this.reactionsByPost = {};
      this.nextCursor = null;
      this.loading = true;
      this.error = null;
      try {
        const page = await http.get<PostsPageDto>(postsPath(channelId));
        if (this.channelId !== channelId) {
          return;
        }
        this.posts = page.posts;
        this.nextCursor = page.nextCursor;
      } catch {
        this.error = 'Impossible de charger les messages.';
      } finally {
        this.loading = false;
      }
    },

    async loadMore(): Promise<void> {
      if (!this.channelId || !this.nextCursor || this.loadingMore) {
        return;
      }
      const channelId = this.channelId;
      this.loadingMore = true;
      try {
        const page = await http.get<PostsPageDto>(postsPath(channelId, this.nextCursor));
        if (this.channelId !== channelId) {
          return;
        }
        const existingIds = new Set(this.posts.map((post) => post.id));
        this.posts.push(...page.posts.filter((post) => !existingIds.has(post.id)));
        this.nextCursor = page.nextCursor;
      } catch {
        this.error = 'Impossible de charger la suite des messages.';
      } finally {
        this.loadingMore = false;
      }
    },

    async sendMessage(body: string): Promise<void> {
      const channelId = this.channelId;
      const trimmed = body.trim();
      if (!channelId || !trimmed) {
        return;
      }
      const post = await http.post<TextPostDto>(`/channels/${channelId}/posts`, {
        body: trimmed,
      } satisfies CreateTextPostRequestDto);
      this.handlePostCreated({ post });
    },

    async postWord(payload: CreateWordEntryRequestDto): Promise<void> {
      const channelId = this.channelId;
      if (!channelId || !payload.term.trim() || !payload.translation.trim()) {
        return;
      }
      const post = await http.post<WordEntryPostDto>(`/channels/${channelId}/posts`, payload);
      this.handlePostCreated({ post });
    },

    async toggleReaction(postId: string, emoji: string): Promise<void> {
      const userId = useAuthStore().user?.id;
      if (!userId) {
        return;
      }
      const alreadyReacted = (this.reactionsByPost[postId] ?? []).some(
        (reaction) => reaction.userId === userId && reaction.emoji === emoji,
      );
      if (alreadyReacted) {
        await http.delete(`/posts/${postId}/reactions/${encodeURIComponent(emoji)}`);
        this.handleReactionRemoved({ postId, userId, emoji });
      } else {
        const reaction = await http.post<ReactionDto>(`/posts/${postId}/reactions`, {
          emoji,
        } satisfies CreateReactionRequestDto);
        this.handleReactionAdded({ reaction });
      }
    },

    handlePostCreated(event: PostCreatedEvent): void {
      if (event.post.channelId !== this.channelId) {
        return;
      }
      if (this.posts.some((post) => post.id === event.post.id)) {
        return;
      }
      this.posts.push(event.post);
    },

    handlePostUpdated(event: PostUpdatedEvent): void {
      if (event.post.channelId !== this.channelId) {
        return;
      }
      const index = this.posts.findIndex((post) => post.id === event.post.id);
      if (index !== -1) {
        this.posts[index] = event.post;
      }
    },

    handlePostDeleted(event: PostDeletedEvent): void {
      if (event.channelId !== this.channelId) {
        return;
      }
      this.posts = this.posts.filter((post) => post.id !== event.postId);
      delete this.reactionsByPost[event.postId];
    },

    handleReactionAdded(event: ReactionAddedEvent): void {
      const { reaction } = event;
      if (!this.posts.some((post) => post.id === reaction.postId)) {
        return;
      }
      const existing = this.reactionsByPost[reaction.postId] ?? [];
      if (existing.some((r) => r.id === reaction.id)) {
        return;
      }
      this.reactionsByPost[reaction.postId] = [...existing, reaction];
    },

    handleReactionRemoved(event: ReactionRemovedEvent): void {
      const existing = this.reactionsByPost[event.postId];
      if (!existing) {
        return;
      }
      this.reactionsByPost[event.postId] = existing.filter(
        (reaction) => !(reaction.userId === event.userId && reaction.emoji === event.emoji),
      );
    },
  },
});
