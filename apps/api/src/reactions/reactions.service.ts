import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReactionDto } from '@social/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

interface ReactionRow {
  id: string;
  postId: string;
  userId: string;
  emoji: string;
}

// Le client Prisma généré (ESM-only, cf. posts.service.spec.ts) n'est jamais
// importé ici : on détecte l'erreur de contrainte unique par duck-typing
// plutôt que via `Prisma.PrismaClientKnownRequestError`.
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async add(postId: string, userId: string, emoji: string): Promise<ReactionDto> {
    try {
      const reaction = await this.prisma.reaction.create({ data: { postId, userId, emoji } });
      const dto = this.toDto(reaction);
      await this.emitAdded(postId, dto);
      return dto;
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      // Même réaction déjà posée par ce user (idempotent) : on la renvoie
      // sans ré-émettre l'événement temps réel, déjà diffusé lors du premier ajout.
      const existing = await this.prisma.reaction.findUnique({
        where: { postId_userId_emoji: { postId, userId, emoji } },
      });
      if (!existing) {
        throw error;
      }
      return this.toDto(existing);
    }
  }

  async remove(postId: string, userId: string, emoji: string): Promise<void> {
    const { count } = await this.prisma.reaction.deleteMany({
      where: { postId, userId, emoji },
    });
    if (count === 0) {
      return;
    }
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { channelId: true },
    });
    if (post) {
      this.realtimeEvents.emitReactionRemoved(post.channelId, { postId, userId, emoji });
    }
  }

  private async emitAdded(postId: string, reaction: ReactionDto): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { channelId: true },
    });
    if (!post) {
      throw new NotFoundException('Message introuvable');
    }
    this.realtimeEvents.emitReactionAdded(post.channelId, { reaction });
  }

  private toDto(reaction: ReactionRow): ReactionDto {
    return {
      id: reaction.id,
      postId: reaction.postId,
      userId: reaction.userId,
      emoji: reaction.emoji,
    };
  }
}
