jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeEventsService } from '../realtime/realtime-events.service';
import { ReactionsService } from './reactions.service';

function createService(
  prismaMock: Record<string, unknown>,
  realtimeMock: Partial<RealtimeEventsService> = {},
): ReactionsService {
  return new ReactionsService(
    prismaMock as unknown as PrismaService,
    {
      emitReactionAdded: jest.fn(),
      emitReactionRemoved: jest.fn(),
      ...realtimeMock,
    } as unknown as RealtimeEventsService,
  );
}

const REACTION_ROW = { id: 'reaction-1', postId: 'post-1', userId: 'user-1', emoji: '👍' };
const UNIQUE_CONSTRAINT_ERROR = { code: 'P2002' };

describe('ReactionsService.add', () => {
  it('crée une réaction et diffuse reaction:added', async () => {
    const create = jest.fn().mockResolvedValue(REACTION_ROW);
    const findUniquePost = jest.fn().mockResolvedValue({ channelId: 'channel-1' });
    const emitReactionAdded = jest.fn();
    const prismaMock = { reaction: { create }, post: { findUnique: findUniquePost } };

    const result = await createService(prismaMock, { emitReactionAdded }).add(
      'post-1',
      'user-1',
      '👍',
    );

    expect(create).toHaveBeenCalledWith({
      data: { postId: 'post-1', userId: 'user-1', emoji: '👍' },
    });
    expect(result).toEqual(REACTION_ROW);
    expect(emitReactionAdded).toHaveBeenCalledWith('channel-1', { reaction: REACTION_ROW });
  });

  it('est idempotent : une réaction déjà posée est renvoyée sans ré-émettre', async () => {
    const create = jest.fn().mockRejectedValue(UNIQUE_CONSTRAINT_ERROR);
    const findUniqueReaction = jest.fn().mockResolvedValue(REACTION_ROW);
    const emitReactionAdded = jest.fn();
    const prismaMock = { reaction: { create, findUnique: findUniqueReaction } };

    const result = await createService(prismaMock, { emitReactionAdded }).add(
      'post-1',
      'user-1',
      '👍',
    );

    expect(findUniqueReaction).toHaveBeenCalledWith({
      where: { postId_userId_emoji: { postId: 'post-1', userId: 'user-1', emoji: '👍' } },
    });
    expect(result).toEqual(REACTION_ROW);
    expect(emitReactionAdded).not.toHaveBeenCalled();
  });

  it('propage les erreurs autres qu’une violation de contrainte unique', async () => {
    const error = new Error('boom');
    const create = jest.fn().mockRejectedValue(error);
    const prismaMock = { reaction: { create } };

    await expect(createService(prismaMock).add('post-1', 'user-1', '👍')).rejects.toBe(error);
  });
});

describe('ReactionsService.remove', () => {
  it('supprime une réaction et diffuse reaction:removed', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUniquePost = jest.fn().mockResolvedValue({ channelId: 'channel-1' });
    const emitReactionRemoved = jest.fn();
    const prismaMock = { reaction: { deleteMany }, post: { findUnique: findUniquePost } };

    await createService(prismaMock, { emitReactionRemoved }).remove('post-1', 'user-1', '👍');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { postId: 'post-1', userId: 'user-1', emoji: '👍' },
    });
    expect(emitReactionRemoved).toHaveBeenCalledWith('channel-1', {
      postId: 'post-1',
      userId: 'user-1',
      emoji: '👍',
    });
  });

  it('est idempotent : rien à supprimer ne diffuse aucun événement', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const emitReactionRemoved = jest.fn();
    const prismaMock = { reaction: { deleteMany } };

    await createService(prismaMock, { emitReactionRemoved }).remove('post-1', 'user-1', '👍');

    expect(emitReactionRemoved).not.toHaveBeenCalled();
  });
});
