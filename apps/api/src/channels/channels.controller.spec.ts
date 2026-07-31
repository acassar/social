import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

// PrismaService mocké ici (cf. invites.controller.spec.ts) : évite de
// charger le client Prisma généré (ESM-only) dans ce test.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { GroupOwnerGuard } from '../groups/group-owner.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

const ACCESS_SECRET = 'access-secret';

describe('ChannelsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const createMock = jest.fn();
  const listMock = jest.fn();
  const updateMock = jest.fn();
  const removeMock = jest.fn();
  const findMembershipMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: {
            create: createMock,
            list: listMock,
            update: updateMock,
            remove: removeMock,
          },
        },
        JwtAuthGuard,
        GroupOwnerGuard,
        GroupMemberGuard,
        { provide: PrismaService, useValue: { membership: { findUnique: findMembershipMock } } },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    createMock.mockReset();
    listMock.mockReset();
    updateMock.mockReset();
    removeMock.mockReset();
    findMembershipMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('GET /groups/:id/channels renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).get('/groups/group-1/channels');

    expect(response.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /groups/:id/channels renvoie 403 pour un non-membre', async () => {
    findMembershipMock.mockReturnValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/channels')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /groups/:id/channels liste les salons pour un membre', async () => {
    findMembershipMock.mockReturnValue({ role: 'member' });
    listMock.mockResolvedValue([{ id: 'channel-1', type: 'text' }]);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/channels')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'channel-1', type: 'text' }]);
  });

  it('POST /groups/:id/channels renvoie 403 pour un membre non-owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/groups/group-1/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'général', type: 'text', position: 0 });

    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('POST /groups/:id/channels crée un salon pour un owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'owner' });
    createMock.mockResolvedValue({
      id: 'channel-1',
      groupId: 'group-1',
      name: 'général',
      type: 'text',
      position: 0,
      createdAt: '2026-07-30T00:00:00.000Z',
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/groups/group-1/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'général', type: 'text', position: 0 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 'channel-1', type: 'text' });
    expect(createMock).toHaveBeenCalledWith('group-1', {
      name: 'général',
      type: 'text',
      position: 0,
    });
  });

  it('POST /groups/:id/channels renvoie 400 pour un type invalide', async () => {
    findMembershipMock.mockReturnValue({ role: 'owner' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/groups/group-1/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'général', type: 'not-a-type', position: 0 });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('PATCH /groups/:id/channels/:channelId renvoie 403 pour un membre non-owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .patch('/groups/group-1/channels/channel-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'nouveau-nom' });

    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('PATCH /groups/:id/channels/:channelId met à jour un salon pour un owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'owner' });
    updateMock.mockResolvedValue({
      id: 'channel-1',
      groupId: 'group-1',
      name: 'nouveau-nom',
      type: 'text',
      position: 0,
      createdAt: '2026-07-30T00:00:00.000Z',
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .patch('/groups/group-1/channels/channel-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'nouveau-nom' });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('group-1', 'channel-1', { name: 'nouveau-nom' });
  });

  it('DELETE /groups/:id/channels/:channelId renvoie 403 pour un membre non-owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .delete('/groups/group-1/channels/channel-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('DELETE /groups/:id/channels/:channelId supprime un salon pour un owner', async () => {
    findMembershipMock.mockReturnValue({ role: 'owner' });
    removeMock.mockResolvedValue(undefined);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .delete('/groups/group-1/channels/channel-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(removeMock).toHaveBeenCalledWith('group-1', 'channel-1');
  });
});
