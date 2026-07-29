import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

// Voir auth.service.spec.ts : évite de charger le client Prisma généré
// (ESM-only) dans ces tests, où PrismaService n'est de toute façon jamais
// instancié réellement (AuthService est mocké).
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let app: INestApplication;
  const registerMock = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { register: registerMock } }],
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
});
