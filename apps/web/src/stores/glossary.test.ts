import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGlossaryStore } from './glossary';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('glossary store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the glossary for a group', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        entries: [
          {
            id: 'post-1',
            channelId: 'channel-1',
            authorId: 'user-1',
            type: 'word_of_day',
            term: 'Feierabend',
            lang: 'de',
            translation: 'fin de journée de travail',
            note: null,
            createdAt: 't',
            editedAt: null,
            deletedAt: null,
          },
        ],
        nextCursor: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const store = useGlossaryStore();
    await store.search('group-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/groups/group-1/glossary',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(store.entries).toHaveLength(1);
    expect(store.nextCursor).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('sends lang and search filters as query params', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ entries: [], nextCursor: null }));
    vi.stubGlobal('fetch', fetchMock);

    const store = useGlossaryStore();
    await store.search('group-1', { lang: 'fr', search: 'Feier' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/groups/group-1/glossary?lang=fr&search=Feier',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads more entries and appends without duplicates', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [{ id: 'post-1', term: 'a' }],
          nextCursor: 'post-1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            { id: 'post-1', term: 'a' },
            { id: 'post-2', term: 'b' },
          ],
          nextCursor: null,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const store = useGlossaryStore();
    await store.search('group-1');
    await store.loadMore();

    expect(store.entries.map((entry) => entry.id)).toEqual(['post-1', 'post-2']);
    expect(store.nextCursor).toBeNull();
  });

  it('records an error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const store = useGlossaryStore();
    await store.search('group-1');

    expect(store.entries).toEqual([]);
    expect(store.error).not.toBeNull();
    expect(store.loading).toBe(false);
  });
});
