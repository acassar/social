import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

// PrismaService mocké ici (cf. channels.controller.spec.ts) : évite de
// charger le client Prisma généré (ESM-only) dans ce test.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { PrismaService } from '../prisma/prisma.service';
import { GlossaryController } from './glossary.controller';
import { GlossaryService } from './glossary.service';

const ACCESS_SECRET = 'access-secret';

describe('GlossaryController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const listMock = jest.fn();
  const findMembershipMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [GlossaryController],
      providers: [
        { provide: GlossaryService, useValue: { list: listMock } },
        JwtAuthGuard,
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
    listMock.mockReset();
    findMembershipMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('GET /groups/:id/glossary renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).get('/groups/group-1/glossary');

    expect(response.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /groups/:id/glossary renvoie 403 pour un non-membre', async () => {
    findMembershipMock.mockResolvedValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/glossary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /groups/:id/glossary liste les mots pour un membre', async () => {
    findMembershipMock.mockResolvedValue({ role: 'member' });
    listMock.mockResolvedValue({ entries: [{ id: 'post-1', term: 'Feierabend' }], nextCursor: null });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/glossary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith('group-1', undefined, undefined, undefined, 30);
    expect(response.body).toEqual({ entries: [{ id: 'post-1', term: 'Feierabend' }], nextCursor: null });
  });

  it('GET /groups/:id/glossary transmet lang/search/cursor/limit', async () => {
    findMembershipMock.mockResolvedValue({ role: 'member' });
    listMock.mockResolvedValue({ entries: [], nextCursor: null });
    const token = await accessTokenFor('user-1');

    await request(app.getHttpServer())
      .get('/groups/group-1/glossary?lang=de&search=Feier&cursor=post-1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(listMock).toHaveBeenCalledWith('group-1', 'de', 'Feier', 'post-1', 5);
  });

  it('GET /groups/:id/glossary renvoie 400 pour une langue invalide', async () => {
    findMembershipMock.mockResolvedValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/groups/group-1/glossary?lang=en')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(listMock).not.toHaveBeenCalled();
  });
});
