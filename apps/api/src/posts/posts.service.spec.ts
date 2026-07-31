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

const POST_ROW = {
  id: 'post-1',
  channelId: 'channel-1',
  authorId: 'user-1',
  type: 'text',
  createdAt: new Date('2026-07-30T00:00:00.000Z'),
  editedAt: null,
  deletedAt: null,
  textMessage: { body: 'salut' },
};

describe('PostsService.createTextPost', () => {
  it('crée un post texte, le diffuse en direct et le renvoie', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', type: 'text' });
    const create = jest.fn().mockResolvedValue(POST_ROW);
    const emitPostCreated = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    const result = await createService(prismaMock, { emitPostCreated }).createTextPost(
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
      include: { textMessage: true },
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
      createService(prismaMock).createTextPost('channel-1', 'user-1', { body: 'salut' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejette (400) un salon qui n'est pas de type text", async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', type: 'memes' });
    const create = jest.fn();
    const prismaMock = { channel: { findUnique: findUniqueChannel }, post: { create } };

    await expect(
      createService(prismaMock).createTextPost('channel-1', 'user-1', { body: 'salut' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('PostsService.list', () => {
  it('liste les posts non supprimés par ordre chronologique, sans page suivante', async () => {
    const findMany = jest.fn().mockResolvedValue([POST_ROW]);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list('channel-1', undefined, 30);

    expect(findMany).toHaveBeenCalledWith({
      where: { channelId: 'channel-1', deletedAt: null },
      include: { textMessage: true },
      orderBy: { createdAt: 'asc' },
      take: 31,
    });
    expect(result.posts).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('renvoie un nextCursor quand il reste des posts, et transmet le curseur reçu', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...POST_ROW,
      id: `post-${i}`,
    }));
    const findMany = jest.fn().mockResolvedValue(rows);
    const prismaMock = { post: { findMany } };

    const result = await createService(prismaMock).list('channel-1', 'post-0', 2);

    expect(findMany).toHaveBeenCalledWith({
      where: { channelId: 'channel-1', deletedAt: null },
      include: { textMessage: true },
      orderBy: { createdAt: 'asc' },
      take: 3,
      cursor: { id: 'post-0' },
      skip: 1,
    });
    expect(result.posts).toHaveLength(2);
    expect(result.nextCursor).toBe('post-1');
  });
});

describe('PostsService.update', () => {
  it("met à jour le body d'un post appartenant à son auteur et diffuse post:updated", async () => {
    const findUnique = jest.fn().mockResolvedValue(POST_ROW);
    const update = jest.fn().mockResolvedValue({ ...POST_ROW, textMessage: { body: 'coucou' } });
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
      include: { textMessage: true },
    });
    expect(result.body).toBe('coucou');
    expect(emitPostUpdated).toHaveBeenCalledWith('channel-1', { post: result });
  });

  it("rejette (403) l'édition par un autre user que l'auteur", async () => {
    const findUnique = jest.fn().mockResolvedValue(POST_ROW);
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
});

describe('PostsService.remove', () => {
  it('soft-delete un post appartenant à son auteur et diffuse post:deleted', async () => {
    const findUnique = jest.fn().mockResolvedValue(POST_ROW);
    const update = jest.fn().mockResolvedValue({ ...POST_ROW, deletedAt: new Date() });
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
    const findUnique = jest.fn().mockResolvedValue(POST_ROW);
    const update = jest.fn();
    const prismaMock = { post: { findUnique, update } };

    await expect(
      createService(prismaMock).remove('channel-1', 'post-1', 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });
});
