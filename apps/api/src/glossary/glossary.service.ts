import { Injectable } from '@nestjs/common';
import type { GlossaryPageDto, NativeLang, WordEntryPostDto } from '@social/shared';
import { PrismaService } from '../prisma/prisma.service';

interface WordPostRow {
  id: string;
  channelId: string;
  authorId: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  wordEntry: { term: string; lang: string; translation: string; note: string | null } | null;
}

@Injectable()
export class GlossaryService {
  constructor(private readonly prisma: PrismaService) {}

  // Agrège les posts `word_of_day` de tous les salons du group (M4-T3) :
  // aucune table dédiée, requête dérivée sur `posts` + `word_entries`
  // (même modèle de pagination par curseur que PostsService.list).
  async list(
    groupId: string,
    lang: NativeLang | undefined,
    search: string | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<GlossaryPageDto> {
    const wordEntryFilter: Record<string, unknown> = {};
    if (lang) {
      wordEntryFilter.lang = lang;
    }
    if (search) {
      wordEntryFilter.OR = [
        { term: { contains: search, mode: 'insensitive' } },
        { translation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const posts = await this.prisma.post.findMany({
      where: {
        type: 'word_of_day',
        deletedAt: null,
        channel: { groupId },
        ...(Object.keys(wordEntryFilter).length ? { wordEntry: wordEntryFilter } : {}),
      },
      include: { wordEntry: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;

    return {
      entries: page.map((post) => this.toDto(post)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  private toDto(post: WordPostRow): WordEntryPostDto {
    return {
      id: post.id,
      channelId: post.channelId,
      authorId: post.authorId,
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
      deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
      type: 'word_of_day',
      term: post.wordEntry?.term ?? '',
      lang: (post.wordEntry?.lang ?? 'fr') as NativeLang,
      translation: post.wordEntry?.translation ?? '',
      note: post.wordEntry?.note ?? null,
    };
  }
}
