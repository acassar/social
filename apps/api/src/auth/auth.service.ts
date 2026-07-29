import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { RegisterResponseDto } from '@social/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import { hashPassword } from './password';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const invite = await this.prisma.invite.findUnique({ where: { code: dto.inviteCode } });

    if (!invite) {
      throw new BadRequestException("Code d'invitation invalide");
    }
    if (invite.usedById) {
      throw new ConflictException("Code d'invitation déjà utilisé");
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Code d'invitation expiré");
    }

    const passwordHash = await hashPassword(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName: dto.displayName,
          nativeLang: dto.nativeLang,
          passwordHash,
        },
      });

      await tx.membership.create({
        data: { groupId: invite.groupId, userId: user.id, role: 'member' },
      });

      // Guard contre la course entre la lecture ci-dessus et cette transaction :
      // si un autre enregistrement a consommé le code entre-temps, ce update ne
      // touche aucune ligne et on annule toute la transaction (409).
      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, usedById: null },
        data: { usedById: user.id },
      });

      if (claimed.count === 0) {
        throw new ConflictException("Code d'invitation déjà utilisé");
      }

      return {
        id: user.id,
        displayName: user.displayName,
        nativeLang: user.nativeLang,
        groupId: invite.groupId,
      };
    });
  }
}
