import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// À utiliser après JwtAuthGuard (qui peuple request.user) : vérifie que le
// user courant est `owner` du group ciblé par le paramètre de route `id`.
@Injectable()
export class GroupOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const groupId = String(request.params.id);
    const userId = request.user?.id;

    const membership = userId
      ? await this.prisma.membership.findUnique({
          where: { groupId_userId: { groupId, userId } },
        })
      : null;

    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException('Réservé au owner du group');
    }

    return true;
  }
}
