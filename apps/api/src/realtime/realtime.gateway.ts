import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from './realtime-events.service';
import { WsJwtGuard } from './ws-jwt.guard';

export function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeEventsService.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.wsJwtGuard.authenticate(client);
      client.data.user = user;

      const memberships = await this.prisma.membership.findMany({
        where: { userId: user.id },
        select: { groupId: true },
      });
      const groupIds = memberships.map((membership) => membership.groupId);

      const channels = groupIds.length
        ? await this.prisma.channel.findMany({
            where: { groupId: { in: groupIds } },
            select: { id: true },
          })
        : [];

      await Promise.all(channels.map((channel) => client.join(channelRoom(channel.id))));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      client.emit('exception', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket déconnecté : ${client.id}`);
  }
}
