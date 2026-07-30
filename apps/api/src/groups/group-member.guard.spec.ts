import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { GroupMemberGuard } from './group-member.guard';

function createContext(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('GroupMemberGuard', () => {
  it('accepte un membre (owner ou member) du group ciblé', async () => {
    const findUnique = jest.fn().mockResolvedValue({ role: 'member' });
    const guard = new GroupMemberGuard({ membership: { findUnique } } as never);
    const context = createContext({ params: { id: 'group-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'group-1', userId: 'user-1' } },
    });
  });

  it('rejette (403) un user sans membership dans le group ciblé', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const guard = new GroupMemberGuard({ membership: { findUnique } } as never);
    const context = createContext({ params: { id: 'group-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejette (403) une requête sans user (guard utilisé hors JwtAuthGuard)', async () => {
    const findUnique = jest.fn();
    const guard = new GroupMemberGuard({ membership: { findUnique } } as never);
    const context = createContext({ params: { id: 'group-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
