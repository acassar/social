import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePostsStore } from './posts';
import { useAuthStore } from './auth';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

const textPost = (overrides: Partial<{ id: string; channelId: string; authorId: string; body: string; createdAt: string }> = {}) => ({
  id: 'p1',
  channelId: 'c1',
  authorId: 'u1',
  type: 'text' as const,
  body: 'hello',
  createdAt: '2026-07-31T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  ...overrides,
});

const wordPost = (
  overrides: Partial<{
    id: string;
    channelId: string;
    authorId: string;
    term: string;
    lang: 'fr' | 'de';
    translation: string;
    note: string | null;
    createdAt: string;
  }> = {},
) => ({
  id: 'w1',
  channelId: 'c1',
  authorId: 'u1',
  type: 'word_of_day' as const,
  term: 'Feierabend',
  lang: 'de' as const,
  translation: 'fin de journée de travail',
  note: null,
  createdAt: '2026-07-31T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  ...overrides,
});

const memePost = (
  overrides: Partial<{
    id: string;
    channelId: string;
    authorId: string;
    url: string;
    thumbUrl: string | null;
    mime: string;
    caption: string | null;
    createdAt: string;
  }> = {},
) => ({
  id: 'm1',
  channelId: 'c1',
  authorId: 'u1',
  type: 'memes' as const,
  attachment: {
    url: overrides.url ?? '/uploads/a.png',
    thumbUrl: overrides.thumbUrl ?? '/uploads/a-thumb.webp',
    mime: overrides.mime ?? 'image/png',
    width: 100,
    height: 100,
  },
  caption: overrides.caption ?? null,
  createdAt: overrides.createdAt ?? '2026-07-31T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  ...overrides,
});

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the first page of a channel', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ posts: [textPost()], nextCursor: 'p1' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const store = usePostsStore();
    await store.loadChannel('c1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/channels/c1/posts',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(store.posts).toHaveLength(1);
    expect(store.nextCursor).toBe('p1');
    expect(store.loading).toBe(false);
  });

  it('appends the next page without duplicating posts on loadMore', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ posts: [textPost()], nextCursor: 'p1' }))
      .mockResolvedValueOnce(
        jsonResponse({ posts: [textPost({ id: 'p1' }), textPost({ id: 'p2' })], nextCursor: null }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const store = usePostsStore();
    await store.loadChannel('c1');
    await store.loadMore();

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/channels/c1/posts?cursor=p1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(store.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(store.nextCursor).toBeNull();
  });

  it('sendMessage posts the message and applies it locally without duplicating the realtime echo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ posts: [], nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse(textPost(), 201));
    vi.stubGlobal('fetch', fetchMock);

    const store = usePostsStore();
    await store.loadChannel('c1');
    await store.sendMessage('hello');

    expect(store.posts).toHaveLength(1);

    store.handlePostCreated({ post: textPost() });
    expect(store.posts).toHaveLength(1);
  });

  it('ignores post events from another channel', () => {
    const store = usePostsStore();
    store.channelId = 'c1';

    store.handlePostCreated({ post: textPost({ channelId: 'other' }) });

    expect(store.posts).toHaveLength(0);
  });

  it('toggleReaction adds then removes a reaction for the current user', async () => {
    const store = usePostsStore();
    const authStore = useAuthStore();
    authStore.user = { id: 'u1', displayName: 'Alice', nativeLang: 'fr', groupId: 'g1' };
    store.channelId = 'c1';
    store.posts = [textPost()];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'r1', postId: 'p1', userId: 'u1', emoji: '👍' }, 201))
      .mockResolvedValueOnce(jsonResponse(undefined, 204));
    vi.stubGlobal('fetch', fetchMock);

    await store.toggleReaction('p1', '👍');
    expect(store.reactionsByPost.p1).toEqual([{ id: 'r1', postId: 'p1', userId: 'u1', emoji: '👍' }]);

    await store.toggleReaction('p1', '👍');
    expect(store.reactionsByPost.p1).toEqual([]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/posts/p1/reactions/%F0%9F%91%8D',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('postWord posts the word entry and applies it locally without duplicating the realtime echo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ posts: [], nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse(wordPost(), 201));
    vi.stubGlobal('fetch', fetchMock);

    const store = usePostsStore();
    await store.loadChannel('c1');
    await store.postWord({ term: 'Feierabend', lang: 'de', translation: 'fin de journée de travail' });

    expect(store.posts).toHaveLength(1);
    expect(store.posts[0]).toMatchObject({ type: 'word_of_day', term: 'Feierabend' });

    store.handlePostCreated({ post: wordPost() });
    expect(store.posts).toHaveLength(1);
  });

  it('keeps posts of mixed types loaded for the active channel (word entries survive the generic store)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ posts: [wordPost()], nextCursor: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const store = usePostsStore();
    await store.loadChannel('c1');

    expect(store.posts).toEqual([wordPost()]);
  });

  it('postMeme posts the meme referencing an already-uploaded file and applies it locally without duplicating the realtime echo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ posts: [], nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse(memePost(), 201));
    vi.stubGlobal('fetch', fetchMock);

    const store = usePostsStore();
    await store.loadChannel('c1');
    await store.postMeme({ url: '/uploads/a.png', mime: 'image/png', caption: 'lol' });

    expect(store.posts).toHaveLength(1);
    expect(store.posts[0]).toMatchObject({ type: 'memes', attachment: { url: '/uploads/a.png' } });

    store.handlePostCreated({ post: memePost() });
    expect(store.posts).toHaveLength(1);
  });

  it('handlePostDeleted removes the post and its reactions', () => {
    const store = usePostsStore();
    store.channelId = 'c1';
    store.posts = [textPost()];
    store.reactionsByPost = { p1: [{ id: 'r1', postId: 'p1', userId: 'u1', emoji: '👍' }] };

    store.handlePostDeleted({ postId: 'p1', channelId: 'c1' });

    expect(store.posts).toHaveLength(0);
    expect(store.reactionsByPost.p1).toBeUndefined();
  });
});
