import { Injectable } from '@nestjs/common';
import type { CreateInviteRequestDto, InviteDto } from '@social/shared';
import { PrismaService } from '../prisma/prisma.service';
import { generateInviteCode } from './invite-code';

// Nombre de tentatives en cas de collision improbable sur `invites.code`
// (contrainte unique en base) avant d'abandonner.
const MAX_CODE_ATTEMPTS = 5;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    groupId: string,
    createdById: string,
    dto: CreateInviteRequestDto,
  ): Promise<InviteDto> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      try {
        const invite = await this.prisma.invite.create({
          data: {
            groupId,
            createdById,
            code: generateInviteCode(),
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
        });
        return this.toDto(invite);
      } catch (error) {
        if (!isUniqueConstraintViolation(error) || attempt === MAX_CODE_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    throw new Error('unreachable');
  }

  async list(groupId: string): Promise<InviteDto[]> {
    const invites = await this.prisma.invite.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((invite) => this.toDto(invite));
  }

  private toDto(invite: {
    id: string;
    code: string;
    groupId: string;
    createdById: string;
    expiresAt: Date | null;
    usedById: string | null;
    createdAt: Date;
  }): InviteDto {
    return {
      id: invite.id,
      code: invite.code,
      groupId: invite.groupId,
      createdById: invite.createdById,
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      usedById: invite.usedById,
      createdAt: invite.createdAt.toISOString(),
    };
  }
}
