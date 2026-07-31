jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import type { PrismaService } from '../prisma/prisma.service';
import { GlossaryService } from './glossary.service';

function createService(prismaMock: Record<string, unknown>): GlossaryService {
  return new GlossaryService(prismaMock as unknown as PrismaService);
}

const WORD_POST_ROW = {
  id: 'post-1',
  channelId: 'channel-1',
  authorId: 'user-1',
  createdAt: new Date('2026-07-31T00:00:00.000Z'),
  editedAt: null,
  deletedAt: null,
  wordEntry: { term: 'Feierabend', lang: 'de', translation: 'fin de journée de travail', note: null },
};

describe('GlossaryService.list', () => {
  it("agrège les mots du group, plus récents d'abord", async () => {
    const findMany = jest.fn().mockResolvedValue([WORD_POST_ROW]);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list('group-1', undefined, undefined, undefined, 30);

    expect(findMany).toHaveBeenCalledWith({
      where: { type: 'word_of_day', deletedAt: null, channel: { groupId: 'group-1' } },
      include: { wordEntry: true },
      orderBy: { createdAt: 'desc' },
      take: 31,
    });
    expect(result).toEqual({
      entries: [
        {
          id: 'post-1',
          channelId: 'channel-1',
          authorId: 'user-1',
          createdAt: '2026-07-31T00:00:00.000Z',
          editedAt: null,
          deletedAt: null,
          type: 'word_of_day',
          term: 'Feierabend',
          lang: 'de',
          translation: 'fin de journée de travail',
          note: null,
        },
      ],
      nextCursor: null,
    });
  });

  it('filtre par langue', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaMock = { post: { findMany } };

    await createService(prismaMock).list('group-1', 'fr', undefined, undefined, 30);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ wordEntry: { lang: 'fr' } }),
      }),
    );
  });

  it('filtre par recherche texte sur term/translation', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaMock = { post: { findMany } };

    await createService(prismaMock).list('group-1', undefined, 'Feier', undefined, 30);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wordEntry: {
            OR: [
              { term: { contains: 'Feier', mode: 'insensitive' } },
              { translation: { contains: 'Feier', mode: 'insensitive' } },
            ],
          },
        }),
      }),
    );
  });

  it('combine langue et recherche dans le même filtre wordEntry', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaMock = { post: { findMany } };

    await createService(prismaMock).list('group-1', 'de', 'Feier', undefined, 30);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wordEntry: {
            lang: 'de',
            OR: [
              { term: { contains: 'Feier', mode: 'insensitive' } },
              { translation: { contains: 'Feier', mode: 'insensitive' } },
            ],
          },
        }),
      }),
    );
  });

  it('pagine par curseur et signale la suite disponible', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...WORD_POST_ROW,
      id: `post-${i}`,
    }));
    const findMany = jest.fn().mockResolvedValue(rows);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list(
      'group-1',
      undefined,
      undefined,
      'cursor-post',
      2,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, cursor: { id: 'cursor-post' }, skip: 1 }),
    );
    expect(result.entries).toHaveLength(2);
    expect(result.nextCursor).toBe('post-1');
  });
});
