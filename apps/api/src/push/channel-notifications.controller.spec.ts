import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChannelMemberGuard } from '../channels/channel-member.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelNotificationsController } from './channel-notifications.controller';
import { PushService } from './push.service';

const ACCESS_SECRET = 'access-secret';

describe('ChannelNotificationsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const getMock = jest.fn();
  const enableMock = jest.fn();
  const disableMock = jest.fn();
  const findChannelMock = jest.fn();
  const findMembershipMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ChannelNotificationsController],
      providers: [
        {
          provide: PushService,
          useValue: {
            getChannelPreference: getMock,
            enableChannelPreference: enableMock,
            disableChannelPreference: disableMock,
          },
        },
        JwtAuthGuard,
        ChannelMemberGuard,
        {
          provide: PrismaService,
          useValue: {
            channel: { findUnique: findChannelMock },
            membership: { findUnique: findMembershipMock },
          },
        },
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
    getMock.mockReset();
    enableMock.mockReset();
    disableMock.mockReset();
    findChannelMock.mockReset();
    findMembershipMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('GET /channels/:id/notifications renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).get('/channels/channel-1/notifications');

    expect(response.status).toBe(401);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('GET /channels/:id/notifications renvoie 403 pour un non-membre', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/channels/channel-1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('GET /channels/:id/notifications renvoie la préférence du user courant', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    getMock.mockResolvedValue({ channelId: 'channel-1', enabled: false });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/channels/channel-1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ channelId: 'channel-1', enabled: false });
    expect(getMock).toHaveBeenCalledWith('channel-1', 'user-1');
  });

  it('POST /channels/:id/notifications active les notifs pour le user courant', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    enableMock.mockResolvedValue({ channelId: 'channel-1', enabled: true });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(enableMock).toHaveBeenCalledWith('channel-1', 'user-1');
  });

  it('DELETE /channels/:id/notifications désactive les notifs pour le user courant', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    disableMock.mockResolvedValue(undefined);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .delete('/channels/channel-1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(disableMock).toHaveBeenCalledWith('channel-1', 'user-1');
  });
});
