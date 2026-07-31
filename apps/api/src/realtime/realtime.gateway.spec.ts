jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { channelRoom, RealtimeGateway } from './realtime.gateway';
import type { RealtimeEventsService } from './realtime-events.service';
import type { WsJwtGuard } from './ws-jwt.guard';

function createSocket(): Socket & { join: jest.Mock; emit: jest.Mock; disconnect: jest.Mock } {
  return {
    id: 'socket-1',
    data: {},
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as Socket & { join: jest.Mock; emit: jest.Mock; disconnect: jest.Mock };
}

function createRealtimeEventsService(): RealtimeEventsService {
  return { setServer: jest.fn() } as unknown as RealtimeEventsService;
}

describe('RealtimeGateway', () => {
  describe('handleConnection', () => {
    it('rejette (déconnecte) un client dont le JWT est absent/invalide', async () => {
      const authenticate = jest.fn().mockRejectedValue(new WsException('Token manquant'));
      const findMany = jest.fn();
      const gateway = new RealtimeGateway(
        { authenticate } as unknown as WsJwtGuard,
        {
          membership: { findMany },
          channel: { findMany },
        } as never,
        createRealtimeEventsService(),
      );
      const socket = createSocket();

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.emit).toHaveBeenCalledWith('exception', expect.any(Object));
      expect(findMany).not.toHaveBeenCalled();
    });

    it('joint le client aux rooms channel:{id} des salons de ses groups', async () => {
      const authenticate = jest.fn().mockResolvedValue({ id: 'user-1' });
      const membershipFindMany = jest.fn().mockResolvedValue([{ groupId: 'group-1' }]);
      const channelFindMany = jest
        .fn()
        .mockResolvedValue([{ id: 'channel-1' }, { id: 'channel-2' }]);
      const gateway = new RealtimeGateway(
        { authenticate } as unknown as WsJwtGuard,
        {
          membership: { findMany: membershipFindMany },
          channel: { findMany: channelFindMany },
        } as never,
        createRealtimeEventsService(),
      );
      const socket = createSocket();

      await gateway.handleConnection(socket);

      expect(membershipFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { groupId: true },
      });
      expect(channelFindMany).toHaveBeenCalledWith({
        where: { groupId: { in: ['group-1'] } },
        select: { id: true },
      });
      expect(socket.join).toHaveBeenCalledWith(channelRoom('channel-1'));
      expect(socket.join).toHaveBeenCalledWith(channelRoom('channel-2'));
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it("ne joint aucune room et n'interroge pas les salons si le user n'a aucun group", async () => {
      const authenticate = jest.fn().mockResolvedValue({ id: 'user-1' });
      const membershipFindMany = jest.fn().mockResolvedValue([]);
      const channelFindMany = jest.fn();
      const gateway = new RealtimeGateway(
        { authenticate } as unknown as WsJwtGuard,
        {
          membership: { findMany: membershipFindMany },
          channel: { findMany: channelFindMany },
        } as never,
        createRealtimeEventsService(),
      );
      const socket = createSocket();

      await gateway.handleConnection(socket);

      expect(channelFindMany).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('ne lève pas — la déconnexion/sortie des rooms est gérée nativement par Socket.io', () => {
      const gateway = new RealtimeGateway(
        {} as unknown as WsJwtGuard,
        {} as never,
        createRealtimeEventsService(),
      );
      expect(() => gateway.handleDisconnect(createSocket())).not.toThrow();
    });
  });

  describe('afterInit', () => {
    it("transmet l'instance Server à RealtimeEventsService (aucune autre logique)", () => {
      const realtimeEventsService = createRealtimeEventsService();
      const gateway = new RealtimeGateway(
        {} as unknown as WsJwtGuard,
        {} as never,
        realtimeEventsService,
      );
      const server = { to: jest.fn() } as never;

      gateway.afterInit(server);

      expect(realtimeEventsService.setServer).toHaveBeenCalledWith(server);
    });
  });
});
