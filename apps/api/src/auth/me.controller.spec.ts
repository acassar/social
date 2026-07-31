import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeController } from './me.controller';

const ACCESS_SECRET = 'access-secret';

describe('MeController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const meMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: AuthService, useValue: { me: meMock } },
        JwtAuthGuard,
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
    meMock.mockReset();
  });

  it('GET /me renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).get('/me');

    expect(response.status).toBe(401);
    expect(meMock).not.toHaveBeenCalled();
  });

  it('GET /me renvoie 401 avec un token invalide', async () => {
    const response = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', 'Bearer not-a-token');

    expect(response.status).toBe(401);
    expect(meMock).not.toHaveBeenCalled();
  });

  it('GET /me renvoie le profil du user identifié par le token', async () => {
    meMock.mockResolvedValue({ id: 'user-1', displayName: 'Alex', nativeLang: 'fr' });
    const accessToken = await jwtService.signAsync({ sub: 'user-1' }, { secret: ACCESS_SECRET });

    const response = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'user-1', displayName: 'Alex', nativeLang: 'fr' });
    expect(meMock).toHaveBeenCalledWith('user-1');
  });
});
