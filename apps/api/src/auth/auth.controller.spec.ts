import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

// Voir auth.service.spec.ts : évite de charger le client Prisma généré
// (ESM-only) dans ces tests, où PrismaService n'est de toute façon jamais
// instancié réellement (AuthService est mocké).
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const ACCESS_SECRET = 'access-secret';

describe('AuthController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const registerMock = jest.fn();
  const loginMock = jest.fn();
  const refreshMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { register: registerMock, login: loginMock, refresh: refreshMock },
        },
        JwtAuthGuard,
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
    registerMock.mockReset();
    loginMock.mockReset();
    refreshMock.mockReset();
  });

  it('POST /auth/register renvoie 201 avec un payload valide', async () => {
    registerMock.mockResolvedValue({
      id: 'user-1',
      displayName: 'Alex',
      nativeLang: 'fr',
      groupId: 'group-1',
    });

    const response = await request(app.getHttpServer()).post('/auth/register').send({
      inviteCode: 'ABC123',
      displayName: 'Alex',
      nativeLang: 'fr',
      password: 'super-secret',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'user-1',
      displayName: 'Alex',
      nativeLang: 'fr',
      groupId: 'group-1',
    });
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ inviteCode: 'ABC123', nativeLang: 'fr' }),
    );
  });

  it('rejette un nativeLang inconnu avec 400 sans appeler le service', async () => {
    const response = await request(app.getHttpServer()).post('/auth/register').send({
      inviteCode: 'ABC123',
      displayName: 'Alex',
      nativeLang: 'en',
      password: 'super-secret',
    });

    expect(response.status).toBe(400);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('rejette un mot de passe trop court avec 400 sans appeler le service', async () => {
    const response = await request(app.getHttpServer()).post('/auth/register').send({
      inviteCode: 'ABC123',
      displayName: 'Alex',
      nativeLang: 'fr',
      password: 'short',
    });

    expect(response.status).toBe(400);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('POST /auth/login renvoie 200 avec les tokens pour des identifiants valides', async () => {
    loginMock.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ displayName: 'Alex', password: 'super-secret' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(loginMock).toHaveBeenCalledWith({ displayName: 'Alex', password: 'super-secret' });
  });

  it('POST /auth/refresh renvoie 200 avec un nouvel access token', async () => {
    refreshMock.mockResolvedValue({ accessToken: 'new-access-token' });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'a-refresh-token' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: 'new-access-token' });
    expect(refreshMock).toHaveBeenCalledWith('a-refresh-token');
  });

  it('POST /auth/logout renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).post('/auth/logout').send();

    expect(response.status).toBe(401);
  });

  it('POST /auth/logout renvoie 200 avec un access token valide', async () => {
    const accessToken = await jwtService.signAsync({ sub: 'user-1' }, { secret: ACCESS_SECRET });

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
