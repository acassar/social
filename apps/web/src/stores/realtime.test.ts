import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { setTokens, clearTokens } from '@/lib/auth';
import { useRealtimeStore } from './realtime';
import { usePostsStore } from './posts';

const { socketMock, ioMock, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socketMock = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    disconnect: vi.fn(),
  };
  return { socketMock, ioMock: vi.fn(() => socketMock), handlers };
});

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('realtime store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    handlers.clear();
    ioMock.mockClear();
    socketMock.on.mockClear();
    socketMock.disconnect.mockClear();
  });

  afterEach(() => {
    clearTokens();
  });

  it('does not connect without a stored access token', () => {
    const store = useRealtimeStore();

    store.connect();

    expect(ioMock).not.toHaveBeenCalled();
    expect(store.connected).toBe(false);
  });

  it('connects with the stored token and tracks connection state', () => {
    setTokens({ accessToken: 'access-1' });
    const store = useRealtimeStore();

    store.connect();

    expect(ioMock).toHaveBeenCalledWith(
      'http://localhost:3000',
      expect.objectContaining({ auth: { token: 'access-1' } }),
    );

    handlers.get('connect')?.();
    expect(store.connected).toBe(true);

    handlers.get('disconnect')?.();
    expect(store.connected).toBe(false);
  });

  it('logs every realtime event it receives', () => {
    setTokens({ accessToken: 'access-1' });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const store = useRealtimeStore();

    store.connect();
    handlers.get('post:created')?.({ post: { id: 'p1' } });

    expect(consoleSpy).toHaveBeenCalledWith('[realtime] post:created', { post: { id: 'p1' } });
    consoleSpy.mockRestore();
  });

  it('dispatches post and reaction events to the posts store', () => {
    setTokens({ accessToken: 'access-1' });
    const store = useRealtimeStore();
    const postsStore = usePostsStore();
    postsStore.channelId = 'c1';

    store.connect();
    handlers.get('post:created')?.({
      post: {
        id: 'p1',
        channelId: 'c1',
        authorId: 'u1',
        type: 'text',
        body: 'hi',
        createdAt: 't',
        editedAt: null,
        deletedAt: null,
      },
    });

    expect(postsStore.posts).toHaveLength(1);
  });

  it('is idempotent and disconnect() tears the socket down', () => {
    setTokens({ accessToken: 'access-1' });
    const store = useRealtimeStore();

    store.connect();
    store.connect();
    expect(ioMock).toHaveBeenCalledTimes(1);

    store.disconnect();
    expect(socketMock.disconnect).toHaveBeenCalled();
    expect(store.socket).toBeNull();
    expect(store.connected).toBe(false);
  });
});
