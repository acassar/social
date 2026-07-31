import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const ensurePushSubscribedMock = vi.fn();
let pushSupported = true;
vi.mock('@/lib/push', () => ({
  isPushSupported: () => pushSupported,
  ensurePushSubscribed: () => ensurePushSubscribedMock(),
}));

import { useNotificationsStore } from './notifications';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

describe('notifications store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    pushSupported = true;
    ensurePushSubscribedMock.mockReset();
    ensurePushSubscribedMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is disabled by default until fetched', () => {
    const store = useNotificationsStore();
    expect(store.isEnabled('channel-1')).toBe(false);
  });

  it('fetches the preference for a channel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ channelId: 'channel-1', enabled: true })),
    );

    const store = useNotificationsStore();
    await store.fetchPreference('channel-1');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/channels/channel-1/notifications',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(store.isEnabled('channel-1')).toBe(true);
  });

  it('enabling subscribes to push then opts in on the channel', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ channelId: 'channel-1', enabled: true }, 201),
    );
    vi.stubGlobal('fetch', fetchMock);

    const store = useNotificationsStore();
    await store.enable('channel-1');

    expect(ensurePushSubscribedMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/channels/channel-1/notifications',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(store.isEnabled('channel-1')).toBe(true);
    expect(store.error).toBeNull();
  });

  it('records an error and leaves the channel disabled when the push subscription fails', async () => {
    ensurePushSubscribedMock.mockRejectedValue(new Error('no permission'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const store = useNotificationsStore();
    await store.enable('channel-1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.isEnabled('channel-1')).toBe(false);
    expect(store.error).not.toBeNull();
  });

  it('disabling opts out without touching the push subscription', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(undefined, 204));
    vi.stubGlobal('fetch', fetchMock);

    const store = useNotificationsStore();
    store.enabledByChannel['channel-1'] = true;
    await store.disable('channel-1');

    expect(ensurePushSubscribedMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/channels/channel-1/notifications',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(store.isEnabled('channel-1')).toBe(false);
  });
});
