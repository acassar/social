import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { WsJwtGuard } from './ws-jwt.guard';

export function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly prisma: PrismaService,
  ) {}

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
