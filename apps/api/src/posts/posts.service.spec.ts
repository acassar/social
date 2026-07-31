jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeEventsService } from '../realtime/realtime-events.service';
import { PostsService } from './posts.service';

function createService(
  prismaMock: Record<string, unknown>,
  realtimeMock: Partial<RealtimeEventsService> = {},
): PostsService {
  return new PostsService(
    prismaMock as unknown as PrismaService,
    {
      emitPostCreated: jest.fn(),
      emitPostUpdated: jest.fn(),
      emitPostDeleted: jest.fn(),
      ...realtimeMock,
    } as unknown as RealtimeEventsService,
  );
}

const POST_INCLUDE = { textMessage: true, wordEntry: true, attachments: true };

const TEXT_POST_ROW = {
  id: 'post-1',
  channelId: 'channel-1',
  authorId: 'user-1',
  type: 'text',
  createdAt: new Date('2026-07-30T00:00:00.000Z'),
  editedAt: null,
  deletedAt: null,
  textMessage: { body: 'salut' },
  wordEntry: null,
  attachments: [],
};

const WORD_ENTRY_POST_ROW = {
  id: 'post-2',
  channelId: 'channel-2',
  authorId: 'user-1',
  type: 'word_of_day',
  createdAt: new Date('2026-07-31T00:00:00.000Z'),
  editedAt: null,
  deletedAt: null,
  textMessage: null,
  wordEntry: { term: 'Feierabend', lang: 'de', translation: 'fin de journée de travail', note: null },
  attachments: [],
};

const MEME_POST_ROW = {
  id: 'post-3',
  channelId: 'channel-3',
  authorId: 'user-1',
  type: 'memes',
  createdAt: new Date('2026-07-31T01:00:00.000Z'),
  editedAt: null,
  deletedAt: null,
  textMessage: null,
  wordEntry: null,
  attachments: [
    { url: '/uploads/abc.webp', thumbUrl: '/uploads/abc-thumb.webp', mime: 'image/webp', width: 800, height: 600 },
  ],
};

describe('PostsService.create — salon text', () => {
  it('crée un post texte, le diffuse en direct et le renvoie', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', type: 'text' });
    const create = jest.fn().mockResolvedValue(TEXT_POST_ROW);
    const emitPostCreated = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    const result = await createService(prismaMock, { emitPostCreated }).create(
      'channel-1',
      'user-1',
      { body: 'salut' },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        channelId: 'channel-1',
        authorId: 'user-1',
        type: 'text',
        textMessage: { create: { body: 'salut' } },
      },
      include: POST_INCLUDE,
    });
    expect(result).toEqual({
      id: 'post-1',
      channelId: 'channel-1',
      authorId: 'user-1',
      type: 'text',
      body: 'salut',
      createdAt: '2026-07-30T00:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
    expect(emitPostCreated).toHaveBeenCalledWith('channel-1', { post: result });
  });

  it('rejette (404) un salon inexistant', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await expect(
      createService(prismaMock).create('channel-1', 'user-1', { body: 'salut' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejette (400) un body vide pour un salon text', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', type: 'text' });
    const create = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await expect(
      createService(prismaMock).create('channel-1', 'user-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

});

describe('PostsService.create — salon word_of_day (M4-T1)', () => {
  it('crée une entrée de mot, la diffuse en direct et la renvoie', async () => {
    const findUniqueChannel = jest
      .fn()
      .mockResolvedValue({ id: 'channel-2', type: 'word_of_day' });
    const create = jest.fn().mockResolvedValue(WORD_ENTRY_POST_ROW);
    const emitPostCreated = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    const result = await createService(prismaMock, { emitPostCreated }).create(
      'channel-2',
      'user-1',
      { term: 'Feierabend', lang: 'de', translation: 'fin de journée de travail' },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        channelId: 'channel-2',
        authorId: 'user-1',
        type: 'word_of_day',
        wordEntry: {
          create: {
            term: 'Feierabend',
            lang: 'de',
            translation: 'fin de journée de travail',
            note: null,
          },
        },
      },
      include: POST_INCLUDE,
    });
    expect(result).toEqual({
      id: 'post-2',
      channelId: 'channel-2',
      authorId: 'user-1',
      type: 'word_of_day',
      term: 'Feierabend',
      lang: 'de',
      translation: 'fin de journée de travail',
      note: null,
      createdAt: '2026-07-31T00:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
    expect(emitPostCreated).toHaveBeenCalledWith('channel-2', { post: result });
  });

  it('transmet la note optionnelle quand elle est fournie', async () => {
    const findUniqueChannel = jest
      .fn()
      .mockResolvedValue({ id: 'channel-2', type: 'word_of_day' });
    const create = jest
      .fn()
      .mockResolvedValue({
        ...WORD_ENTRY_POST_ROW,
        wordEntry: { ...WORD_ENTRY_POST_ROW.wordEntry, note: 'entendu au bureau' },
      });
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await createService(prismaMock).create('channel-2', 'user-1', {
      term: 'Feierabend',
      lang: 'de',
      translation: 'fin de journée de travail',
      note: 'entendu au bureau',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wordEntry: { create: expect.objectContaining({ note: 'entendu au bureau' }) },
        }),
      }),
    );
  });

  it.each([
    ['term manquant', { lang: 'de' as const, translation: 'x' }],
    ['lang manquant', { term: 'x', translation: 'x' }],
    ['translation manquante', { term: 'x', lang: 'de' as const }],
  ])('rejette (400) une entrée incomplète : %s', async (_label, dto) => {
    const findUniqueChannel = jest
      .fn()
      .mockResolvedValue({ id: 'channel-2', type: 'word_of_day' });
    const create = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await expect(
      createService(prismaMock).create('channel-2', 'user-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('PostsService.create — salon memes (M5-T2)', () => {
  it('crée un post mème (avec légende), le diffuse en direct et le renvoie', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-3', type: 'memes' });
    const create = jest.fn().mockResolvedValue(MEME_POST_ROW);
    const emitPostCreated = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    const result = await createService(prismaMock, { emitPostCreated }).create(
      'channel-3',
      'user-1',
      {
        url: '/uploads/abc.webp',
        thumbUrl: '/uploads/abc-thumb.webp',
        mime: 'image/webp',
        width: 800,
        height: 600,
        body: 'regardez ça',
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        channelId: 'channel-3',
        authorId: 'user-1',
        type: 'memes',
        attachments: {
          create: {
            url: '/uploads/abc.webp',
            thumbUrl: '/uploads/abc-thumb.webp',
            mime: 'image/webp',
            width: 800,
            height: 600,
          },
        },
        textMessage: { create: { body: 'regardez ça' } },
      },
      include: POST_INCLUDE,
    });
    expect(result).toEqual({
      id: 'post-3',
      channelId: 'channel-3',
      authorId: 'user-1',
      type: 'memes',
      attachment: {
        url: '/uploads/abc.webp',
        thumbUrl: '/uploads/abc-thumb.webp',
        mime: 'image/webp',
        width: 800,
        height: 600,
      },
      caption: null,
      createdAt: '2026-07-31T01:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
    expect(emitPostCreated).toHaveBeenCalledWith('channel-3', { post: result });
  });

  it('crée un post mème sans légende (caption optionnelle)', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-3', type: 'memes' });
    const create = jest.fn().mockResolvedValue({ ...MEME_POST_ROW, textMessage: null });
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await createService(prismaMock).create('channel-3', 'user-1', {
      url: '/uploads/abc.webp',
      mime: 'image/webp',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ textMessage: expect.anything() }),
      }),
    );
  });

  it.each([
    ['url manquante', { mime: 'image/webp' as const }],
    ['mime manquant', { url: '/uploads/abc.webp' }],
  ])('rejette (400) un mème incomplet : %s', async (_label, dto) => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-3', type: 'memes' });
    const create = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await expect(
      createService(prismaMock).create('channel-3', 'user-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('PostsService.list', () => {
  it('liste les posts non supprimés par ordre chronologique, sans page suivante', async () => {
    const findMany = jest.fn().mockResolvedValue([TEXT_POST_ROW]);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list('channel-1', undefined, 30);

    expect(findMany).toHaveBeenCalledWith({
      where: { channelId: 'channel-1', deletedAt: null },
      include: POST_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: 31,
    });
    expect(result.posts).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('renvoie un nextCursor quand il reste des posts, et transmet le curseur reçu', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...TEXT_POST_ROW,
      id: `post-${i}`,
    }));
    const findMany = jest.fn().mockResolvedValue(rows);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list('channel-1', 'post-0', 2);

    expect(findMany).toHaveBeenCalledWith({
      where: { channelId: 'channel-1', deletedAt: null },
      include: POST_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: 3,
      cursor: { id: 'post-0' },
      skip: 1,
    });
    expect(result.posts).toHaveLength(2);
    expect(result.nextCursor).toBe('post-1');
  });

  it('renvoie aussi bien des posts text que word_of_day', async () => {
    const findMany = jest.fn().mockResolvedValue([TEXT_POST_ROW, WORD_ENTRY_POST_ROW]);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list('channel-1', undefined, 30);

    expect(result.posts.map((p) => p.type)).toEqual(['text', 'word_of_day']);
  });
});

describe('PostsService.update', () => {
  it("met à jour le body d'un post appartenant à son auteur et diffuse post:updated", async () => {
    const findUnique = jest.fn().mockResolvedValue(TEXT_POST_ROW);
    const update = jest
      .fn()
      .mockResolvedValue({ ...TEXT_POST_ROW, textMessage: { body: 'coucou' } });
    const emitPostUpdated = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    const result = await createService(prismaMock, { emitPostUpdated }).update(
      'channel-1',
      'post-1',
      'user-1',
      { body: 'coucou' },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { editedAt: expect.any(Date), textMessage: { update: { body: 'coucou' } } },
      include: POST_INCLUDE,
    });
    expect(result.body).toBe('coucou');
    expect(emitPostUpdated).toHaveBeenCalledWith('channel-1', { post: result });
  });

  it("rejette (403) l'édition par un autre user que l'auteur", async () => {
    const findUnique = jest.fn().mockResolvedValue(TEXT_POST_ROW);
    const update = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    await expect(
      createService(prismaMock).update('channel-1', 'post-1', 'user-2', { body: 'coucou' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejette (404) un post inexistant, supprimé, ou d'un autre salon", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const update = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    await expect(
      createService(prismaMock).update('channel-1', 'post-1', 'user-1', { body: 'coucou' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejette (400) l'édition d'un post qui n'est pas de type text", async () => {
    const findUnique = jest.fn().mockResolvedValue(WORD_ENTRY_POST_ROW);
    const update = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    await expect(
      createService(prismaMock).update('channel-2', 'post-2', 'user-1', { body: 'coucou' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('PostsService.remove', () => {
  it('soft-delete un post appartenant à son auteur et diffuse post:deleted', async () => {
    const findUnique = jest.fn().mockResolvedValue(TEXT_POST_ROW);
    const update = jest.fn().mockResolvedValue({ ...TEXT_POST_ROW, deletedAt: new Date() });
    const emitPostDeleted = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    await createService(prismaMock, { emitPostDeleted }).remove('channel-1', 'post-1', 'user-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(emitPostDeleted).toHaveBeenCalledWith('channel-1', {
      postId: 'post-1',
      channelId: 'channel-1',
    });
  });

  it('rejette (403) la suppression par un autre user que l’auteur', async () => {
    const findUnique = jest.fn().mockResolvedValue(TEXT_POST_ROW);
    const update = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    await expect(
      createService(prismaMock).remove('channel-1', 'post-1', 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });
});
