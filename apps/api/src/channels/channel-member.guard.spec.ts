import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { ChannelMemberGuard } from './channel-member.guard';

function createContext(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ChannelMemberGuard', () => {
  it('accepte un membre du group auquel appartient le salon ciblé', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    const findUniqueMembership = jest.fn().mockResolvedValue({ role: 'member' });
    const guard = new ChannelMemberGuard({
      channel: { findUnique: findUniqueChannel },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'channel-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUniqueMembership).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'group-1', userId: 'user-1' } },
    });
  });

  it('rejette (404) un salon inexistant', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue(null);
    const findUniqueMembership = jest.fn();
    const guard = new ChannelMemberGuard({
      channel: { findUnique: findUniqueChannel },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'channel-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
    expect(findUniqueMembership).not.toHaveBeenCalled();
  });

  it('rejette (403) un user sans membership dans le group du salon', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    const findUniqueMembership = jest.fn().mockResolvedValue(null);
    const guard = new ChannelMemberGuard({
      channel: { findUnique: findUniqueChannel },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'channel-1' }, user: { id: 'user-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejette (403) une requête sans user (guard utilisé hors JwtAuthGuard)', async () => {
    const findUniqueChannel = jest.fn().mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    const findUniqueMembership = jest.fn();
    const guard = new ChannelMemberGuard({
      channel: { findUnique: findUniqueChannel },
      membership: { findUnique: findUniqueMembership },
    } as never);
    const context = createContext({ params: { id: 'channel-1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUniqueMembership).not.toHaveBeenCalled();
  });
});
