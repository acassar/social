import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// À utiliser après JwtAuthGuard : vérifie que le post ciblé par le paramètre
// de route `id` existe (et n'est pas soft-supprimé) et que le user courant
// est membre du group auquel appartient son salon. Symétrique à
// ChannelMemberGuard, mais keyé sur un postId (routes `/posts/:id/reactions`).
@Injectable()
export class PostMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const postId = String(request.params.id);
    const userId = request.user?.id;

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { channel: true },
    });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Message introuvable');
    }

    const membership = userId
      ? await this.prisma.membership.findUnique({
          where: { groupId_userId: { groupId: post.channel.groupId, userId } },
        })
      : null;

    if (!membership) {
      throw new ForbiddenException('Réservé aux membres du group');
    }

    return true;
  }
}
