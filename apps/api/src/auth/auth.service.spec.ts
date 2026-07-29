import { BadRequestException, ConflictException } from '@nestjs/common';

// Le client Prisma généré est un module ESM-only (import.meta.url) que
// ts-jest en mode CommonJS ne peut pas exécuter ; on le remplace ici pour
// ne jamais le charger dans ces tests unitaires (PrismaService est mocké
// directement, l'implémentation réelle n'a pas besoin d'être chargée).
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';

const baseDto: RegisterDto = {
  inviteCode: 'ABC123',
  displayName: 'Alex',
  nativeLang: 'fr',
  password: 'super-secret',
};

function createService(prismaMock: Record<string, unknown>): AuthService {
  return new AuthService(prismaMock as unknown as PrismaService);
}

describe('AuthService.register', () => {
  it("crée le user, la membership et marque l'invite comme utilisée", async () => {
    const invite = {
      id: 'invite-1',
      groupId: 'group-1',
      usedById: null,
      expiresAt: null,
    };
    const createdUser = {
      id: 'user-1',
      displayName: baseDto.displayName,
      nativeLang: baseDto.nativeLang,
    };
    const tx = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      membership: { create: jest.fn().mockResolvedValue({}) },
      invite: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prismaMock = {
      invite: { findUnique: jest.fn().mockResolvedValue(invite) },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };

    const result = await createService(prismaMock).register(baseDto);

    expect(result).toEqual({
      id: 'user-1',
      displayName: baseDto.displayName,
      nativeLang: baseDto.nativeLang,
      groupId: 'group-1',
    });
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', userId: 'user-1', role: 'member' },
    });
    expect(tx.invite.updateMany).toHaveBeenCalledWith({
      where: { id: 'invite-1', usedById: null },
      data: { usedById: 'user-1' },
    });
  });

  it('rejette un code inexistant (400)', async () => {
    const prismaMock = {
      invite: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };

    await expect(createService(prismaMock).register(baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejette un code déjà utilisé (409)', async () => {
    const invite = { id: 'invite-1', groupId: 'group-1', usedById: 'someone', expiresAt: null };
    const prismaMock = {
      invite: { findUnique: jest.fn().mockResolvedValue(invite) },
      $transaction: jest.fn(),
    };

    await expect(createService(prismaMock).register(baseDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejette un code expiré (400)', async () => {
    const invite = {
      id: 'invite-1',
      groupId: 'group-1',
      usedById: null,
      expiresAt: new Date(Date.now() - 1000),
    };
    const prismaMock = {
      invite: { findUnique: jest.fn().mockResolvedValue(invite) },
      $transaction: jest.fn(),
    };

    await expect(createService(prismaMock).register(baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejette (409) une invite consommée entre la lecture et la transaction (race condition)', async () => {
    const invite = { id: 'invite-1', groupId: 'group-1', usedById: null, expiresAt: null };
    const createdUser = {
      id: 'user-1',
      displayName: baseDto.displayName,
      nativeLang: baseDto.nativeLang,
    };
    const tx = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      membership: { create: jest.fn().mockResolvedValue({}) },
      invite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prismaMock = {
      invite: { findUnique: jest.fn().mockResolvedValue(invite) },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };

    await expect(createService(prismaMock).register(baseDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
