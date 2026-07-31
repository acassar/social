import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// Le client Prisma généré est un module ESM-only (import.meta.url) que
// ts-jest en mode CommonJS ne peut pas exécuter ; on le remplace ici pour
// ne jamais le charger dans ces tests unitaires (PrismaService est mocké
// directement, l'implémentation réelle n'a pas besoin d'être chargée).
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { AuthService } from './auth.service';
import type { EnvironmentVariables } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { hashPassword } from './password';

const baseDto: RegisterDto = {
  inviteCode: 'ABC123',
  displayName: 'Alex',
  nativeLang: 'fr',
  password: 'super-secret',
};

const ENV = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '30d',
} as const;

function createConfigServiceMock(): ConfigService<EnvironmentVariables, true> {
  return {
    get: jest.fn((key: keyof typeof ENV) => ENV[key]),
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

function createService(prismaMock: Record<string, unknown>): AuthService {
  return new AuthService(
    prismaMock as unknown as PrismaService,
    new JwtService(),
    createConfigServiceMock(),
  );
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

  it('rejette (409) un display_name déjà pris (contrainte unique en base)', async () => {
    const invite = { id: 'invite-1', groupId: 'group-1', usedById: null, expiresAt: null };
    const uniqueConstraintError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    const tx = {
      user: { create: jest.fn().mockRejectedValue(uniqueConstraintError) },
      membership: { create: jest.fn() },
      invite: { updateMany: jest.fn() },
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

describe('AuthService.login', () => {
  const loginDto: LoginDto = { displayName: 'Alex', password: 'super-secret' };

  it('renvoie un access token et un refresh token pour des identifiants valides', async () => {
    const passwordHash = await hashPassword('super-secret');
    const prismaMock = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', passwordHash }) },
    };

    const service = createService(prismaMock);
    const tokens = await service.login(loginDto);

    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');

    const jwtService = new JwtService();
    await expect(
      jwtService.verifyAsync(tokens.accessToken, { secret: ENV.JWT_ACCESS_SECRET }),
    ).resolves.toMatchObject({ sub: 'user-1' });
    await expect(
      jwtService.verifyAsync(tokens.refreshToken, { secret: ENV.JWT_REFRESH_SECRET }),
    ).resolves.toMatchObject({ sub: 'user-1' });
  });

  it('rejette (401) un display_name inconnu', async () => {
    const prismaMock = { user: { findUnique: jest.fn().mockResolvedValue(null) } };

    await expect(createService(prismaMock).login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejette (401) un mauvais mot de passe', async () => {
    const passwordHash = await hashPassword('super-secret');
    const prismaMock = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', passwordHash }) },
    };

    await expect(
      createService(prismaMock).login({ ...loginDto, password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh', () => {
  it('régénère un access token à partir d’un refresh token valide', async () => {
    const jwtService = new JwtService();
    const refreshToken = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: ENV.JWT_REFRESH_SECRET, expiresIn: ENV.JWT_REFRESH_EXPIRES_IN },
    );
    const prismaMock = {};

    const result = await createService(prismaMock).refresh(refreshToken);

    await expect(
      jwtService.verifyAsync(result.accessToken, { secret: ENV.JWT_ACCESS_SECRET }),
    ).resolves.toMatchObject({ sub: 'user-1' });
  });

  it('rejette (401) un refresh token invalide', async () => {
    const prismaMock = {};

    await expect(createService(prismaMock).refresh('not-a-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejette (401) un access token présenté comme refresh token (mauvais secret)', async () => {
    const jwtService = new JwtService();
    const accessToken = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: ENV.JWT_ACCESS_SECRET, expiresIn: ENV.JWT_ACCESS_EXPIRES_IN },
    );
    const prismaMock = {};

    await expect(createService(prismaMock).refresh(accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.me', () => {
  it('renvoie le profil du user identifié par le token, avec le group de sa membership', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          displayName: 'Alex',
          nativeLang: 'fr',
          avatarUrl: null,
        }),
      },
      membership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-1', groupId: 'group-1' }),
      },
    };

    await expect(createService(prismaMock).me('user-1')).resolves.toEqual({
      id: 'user-1',
      displayName: 'Alex',
      nativeLang: 'fr',
      avatarUrl: undefined,
      groupId: 'group-1',
    });
  });

  it('rejette (401) si le user du token n’existe plus', async () => {
    const prismaMock = { user: { findUnique: jest.fn().mockResolvedValue(null) } };

    await expect(createService(prismaMock).me('gone')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejette (401) si le user n’a plus aucune membership', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          displayName: 'Alex',
          nativeLang: 'fr',
          avatarUrl: null,
        }),
      },
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(createService(prismaMock).me('user-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
