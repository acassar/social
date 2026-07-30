import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// À utiliser après JwtAuthGuard : vérifie que le salon ciblé par le
// paramètre de route `id` existe et que le user courant est membre du group
// auquel il appartient. Symétrique à GroupMemberGuard, mais keyé sur un
// channelId plutôt qu'un groupId (routes `/channels/:id/...`, ex. posts).
@Injectable()
export class ChannelMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const channelId = String(request.params.id);
    const userId = request.user?.id;

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Salon introuvable');
    }

    const membership = userId
      ? await this.prisma.membership.findUnique({
          where: { groupId_userId: { groupId: channel.groupId, userId } },
        })
      : null;

    if (!membership) {
      throw new ForbiddenException('Réservé aux membres du group');
    }

    return true;
  }
}
