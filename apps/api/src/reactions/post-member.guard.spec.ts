import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { PostMemberGuard } from './post-member.guard';

function createContext(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const POST_ROW = { id: 'post-1', deletedAt: null, channel: { groupId: 'group-1' } };

describe('PostMemberGuard', () => {
  it('accepte un membre du group auquel appartient le salon du post', async () => {
    const findUniquePost = jest.fn().mockResolvedValue(POST_ROW);
    const findUniqueMembership = jest.fn().mockResolvedValue({ role: 'member' });
    const guard = new PostMemberGuard({
      post: { findUnique: findUniquePost },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'post-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUniqueMembership).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'group-1', userId: 'user-1' } },
    });
  });

  it('rejette (404) un post inexistant', async () => {
    const findUniquePost = jest.fn().mockResolvedValue(null);
    const findUniqueMembership = jest.fn();
    const guard = new PostMemberGuard({
      post: { findUnique: findUniquePost },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'post-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
    expect(findUniqueMembership).not.toHaveBeenCalled();
  });

  it('rejette (404) un post soft-supprimé', async () => {
    const findUniquePost = jest
      .fn()
      .mockResolvedValue({ ...POST_ROW, deletedAt: new Date('2026-07-30T00:00:00.000Z') });
    const findUniqueMembership = jest.fn();
    const guard = new PostMemberGuard({
      post: { findUnique: findUniquePost },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'post-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejette (403) un user sans membership dans le group du salon', async () => {
    const findUniquePost = jest.fn().mockResolvedValue(POST_ROW);
    const findUniqueMembership = jest.fn().mockResolvedValue(null);
    const guard = new PostMemberGuard({
      post: { findUnique: findUniquePost },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'post-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejette (403) une requête sans user (guard utilisé hors JwtAuthGuard)', async () => {
    const findUniquePost = jest.fn().mockResolvedValue(POST_ROW);
    const findUniqueMembership = jest.fn();
    const guard = new PostMemberGuard({
      post: { findUnique: findUniquePost },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'post-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUniqueMembership).not.toHaveBeenCalled();
  });
});
