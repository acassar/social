import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

const ACCESS_SECRET = 'access-secret';

describe('PushController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const subscribeMock = jest.fn();
  const unsubscribeMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PushController],
      providers: [
        {
          provide: PushService,
          useValue: { subscribe: subscribeMock, unsubscribe: unsubscribeMock },
        },
        JwtAuthGuard,
        { provide: PrismaService, useValue: {} },
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
    subscribeMock.mockReset();
    unsubscribeMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('POST /push/subscribe renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer())
      .post('/push/subscribe')
      .send({ endpoint: 'https://push.example/ep', keys: { p256dh: 'p', auth: 'a' } });

    expect(response.status).toBe(401);
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it('POST /push/subscribe enregistre un abonnement pour le user courant', async () => {
    subscribeMock.mockResolvedValue(undefined);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example/ep', keys: { p256dh: 'p', auth: 'a' } });

    expect(response.status).toBe(204);
    expect(subscribeMock).toHaveBeenCalledWith('user-1', 'https://push.example/ep', {
      p256dh: 'p',
      auth: 'a',
    });
  });

  it('POST /push/subscribe renvoie 400 sans endpoint', async () => {
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ keys: { p256dh: 'p', auth: 'a' } });

    expect(response.status).toBe(400);
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it('DELETE /push/subscribe désabonne le user courant', async () => {
    unsubscribeMock.mockResolvedValue(undefined);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .delete('/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example/ep' });

    expect(response.status).toBe(204);
    expect(unsubscribeMock).toHaveBeenCalledWith('user-1', 'https://push.example/ep');
  });
});
