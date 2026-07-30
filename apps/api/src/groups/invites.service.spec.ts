jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import type { PrismaService } from '../prisma/prisma.service';
import { InvitesService } from './invites.service';

function createService(prismaMock: Record<string, unknown>): InvitesService {
  return new InvitesService(prismaMock as unknown as PrismaService);
}

describe('InvitesService.create', () => {
  it('crée une invitation avec un code généré et la renvoie', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'invite-1',
      code: 'abc123',
      groupId: 'group-1',
      createdById: 'user-1',
      expiresAt: null,
      usedById: null,
      createdAt: new Date('2026-07-30T00:00:00.000Z'),
    });
    const prismaMock = { invite: { create } };

    const result = await createService(prismaMock).create('group-1', 'user-1', {});

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupId: 'group-1', createdById: 'user-1' }),
      }),
    );
    expect(result).toEqual({
      id: 'invite-1',
      code: 'abc123',
      groupId: 'group-1',
      createdById: 'user-1',
      expiresAt: null,
      usedById: null,
      createdAt: '2026-07-30T00:00:00.000Z',
    });
  });

  it('transmet expiresAt converti en Date quand fourni', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'invite-1',
      code: 'abc123',
      groupId: 'group-1',
      createdById: 'user-1',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      usedById: null,
      createdAt: new Date('2026-07-30T00:00:00.000Z'),
    });
    const prismaMock = { invite: { create } };

    const result = await createService(prismaMock).create('group-1', 'user-1', {
      expiresAt: '2026-08-01T00:00:00.000Z',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: new Date('2026-08-01T00:00:00.000Z') }),
      }),
    );
    expect(result.expiresAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('retente en cas de collision de code (contrainte unique) puis réussit', async () => {
    const uniqueConstraintError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    const create = jest
      .fn()
      .mockRejectedValueOnce(uniqueConstraintError)
      .mockResolvedValueOnce({
        id: 'invite-1',
        code: 'retry-code',
        groupId: 'group-1',
        createdById: 'user-1',
        expiresAt: null,
        usedById: null,
        createdAt: new Date('2026-07-30T00:00:00.000Z'),
      });
    const prismaMock = { invite: { create } };

    const result = await createService(prismaMock).create('group-1', 'user-1', {});

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.code).toBe('retry-code');
  });
});

describe('InvitesService.list', () => {
  it("liste les invitations d'un group, plus récentes d'abord", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'invite-1',
        code: 'abc123',
        groupId: 'group-1',
        createdById: 'user-1',
        expiresAt: null,
        usedById: null,
        createdAt: new Date('2026-07-30T00:00:00.000Z'),
      },
    ]);
    const prismaMock = { invite: { findMany } };

    const result = await createService(prismaMock).list('group-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'invite-1', code: 'abc123' });
  });
});
