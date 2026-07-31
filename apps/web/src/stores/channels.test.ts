import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChannelsStore } from './channels';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('channels store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and sorts channels by position', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([
        { id: 'c2', groupId: 'g1', name: 'memes', type: 'memes', position: 2, createdAt: 't' },
        { id: 'c1', groupId: 'g1', name: 'general', type: 'text', position: 0, createdAt: 't' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const store = useChannelsStore();
    await store.fetchChannels('g1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/groups/g1/channels',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(store.groupId).toBe('g1');
    expect(store.sortedChannels.map((channel) => channel.id)).toEqual(['c1', 'c2']);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('records an error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const store = useChannelsStore();
    await store.fetchChannels('g1');

    expect(store.channels).toEqual([]);
    expect(store.error).not.toBeNull();
    expect(store.loading).toBe(false);
  });
});
