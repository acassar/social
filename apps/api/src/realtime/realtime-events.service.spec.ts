jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { RealtimeEventsService } from './realtime-events.service';
import { channelRoom } from './realtime.gateway';

describe('RealtimeEventsService (intégration Socket.io réelle)', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let service: RealtimeEventsService;
  let baseUrl: string;

  beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer);
    // Le join de room reproduit ici ce que fait RealtimeGateway.handleConnection
    // (le socket rejoint la room du salon qu'il indique), sans passer par
    // l'auth JWT — hors périmètre de ce test, déjà couvert par ws-jwt.guard.spec.ts.
    io.on('connection', (socket) => {
      socket.on('join', (room: string) => socket.join(room));
    });
    service = new RealtimeEventsService();
    service.setServer(io);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connectAndJoin(room: string): Promise<ClientSocket> {
    return new Promise((resolve) => {
      const client = ioClient(baseUrl, { forceNew: true });
      client.on('connect', () => {
        client.emit('join', room);
        // Laisse le temps au serveur de traiter le `join` avant de résoudre.
        setTimeout(() => resolve(client), 50);
      });
    });
  }

  it("diffuse un événement vers les clients d'une room et pas vers les autres", async () => {
    const channelId = 'channel-1';
    const otherChannelId = 'channel-2';
    const [clientInRoom, clientOutOfRoom] = await Promise.all([
      connectAndJoin(channelRoom(channelId)),
      connectAndJoin(channelRoom(otherChannelId)),
    ]);

    try {
      const received: unknown[] = [];
      const otherReceived: unknown[] = [];
      clientInRoom.on('post:created', (payload: unknown) => received.push(payload));
      clientOutOfRoom.on('post:created', (payload: unknown) => otherReceived.push(payload));

      const payload = {
        post: {
          id: 'post-1',
          channelId,
          authorId: 'user-1',
          type: 'text' as const,
          body: 'salut',
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
        },
      };
      service.emitPostCreated(channelId, payload);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received).toEqual([payload]);
      expect(otherReceived).toEqual([]);
    } finally {
      clientInRoom.disconnect();
      clientOutOfRoom.disconnect();
    }
  });

  it("n'envoie rien et ne lève pas si le serveur n'a pas encore été initialisé", () => {
    const uninitializedService = new RealtimeEventsService();
    expect(() =>
      uninitializedService.emitReactionAdded('channel-1', {
        reaction: { id: 'r1', postId: 'post-1', userId: 'user-1', emoji: '👍' },
      }),
    ).not.toThrow();
  });
});
