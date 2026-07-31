import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

// PrismaService mocké ici : GroupOwnerGuard reste la vraie implémentation
// (testée via ce mock plutôt que dupliquée), seul son accès base de données
// est simulé — évite de charger le client Prisma généré (ESM-only).
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { GroupOwnerGuard } from './group-owner.guard';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

const ACCESS_SECRET = 'access-secret';

describe('InvitesController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const createMock = jest.fn();
  const listMock = jest.fn();
  const findMembershipMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InvitesController],
      providers: [
        { provide: InvitesService, useValue: { create: createMock, list: listMock } },
        JwtAuthGuard,
        GroupOwnerGuard,
        { provide: PrismaService, useValue: { membership: { findUnique: findMembershipMock } } },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    createMock.mockReset();
    listMock.mockReset();
    findMembershipMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('POST /groups/:id/invites renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).post('/groups/group-1/invites').send({});

    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('POST /groups/:id/invites renvoie 403 pour un membre non-owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/groups/group-1/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('POST /groups/:id/invites crée une invitation pour un owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'owner' });
    createMock.mockResolvedValue({
      id: 'invite-1',
      code: 'abc123',
      groupId: 'group-1',
      createdById: 'user-1',
      expiresAt: null,
      usedById: null,
      createdAt: '2026-07-30T00:00:00.000Z',
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/groups/group-1/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 'invite-1', code: 'abc123' });
    expect(createMock).toHaveBeenCalledWith('group-1', 'user-1', {});
  });

  it('GET /groups/:id/invites liste les invitations pour un owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'owner' });
    listMock.mockResolvedValue([{ id: 'invite-1', code: 'abc123' }]);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/invites')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'invite-1', code: 'abc123' }]);
  });

  it('GET /groups/:id/invites renvoie 403 pour un non-membre', async () => {
    findMembershipMock.mockReturnValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/invites')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });
});
