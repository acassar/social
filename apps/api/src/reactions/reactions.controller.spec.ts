import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

// PrismaService mocké ici (cf. posts.controller.spec.ts) : évite de charger
// le client Prisma généré (ESM-only) dans ce test.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PostMemberGuard } from './post-member.guard';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

const ACCESS_SECRET = 'access-secret';

describe('ReactionsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const addMock = jest.fn();
  const removeMock = jest.fn();
  const findPostMock = jest.fn();
  const findMembershipMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ReactionsController],
      providers: [
        { provide: ReactionsService, useValue: { add: addMock, remove: removeMock } },
        JwtAuthGuard,
        PostMemberGuard,
        {
          provide: PrismaService,
          useValue: {
            post: { findUnique: findPostMock },
            membership: { findUnique: findMembershipMock },
          },
        },
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
    addMock.mockReset();
    removeMock.mockReset();
    findPostMock.mockReset();
    findMembershipMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('POST /posts/:id/reactions renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer())
      .post('/posts/post-1/reactions')
      .send({ emoji: '👍' });

    expect(response.status).toBe(401);
    expect(addMock).not.toHaveBeenCalled();
  });

  it('POST /posts/:id/reactions renvoie 404 pour un post inexistant', async () => {
    findPostMock.mockResolvedValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/posts/post-1/reactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });

    expect(response.status).toBe(404);
    expect(addMock).not.toHaveBeenCalled();
  });

  it('POST /posts/:id/reactions renvoie 403 pour un non-membre', async () => {
    findPostMock.mockResolvedValue({
      id: 'post-1',
      deletedAt: null,
      channel: { groupId: 'group-1' },
    });
    findMembershipMock.mockResolvedValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/posts/post-1/reactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });

    expect(response.status).toBe(403);
    expect(addMock).not.toHaveBeenCalled();
  });

  it('POST /posts/:id/reactions ajoute une réaction pour un membre', async () => {
    findPostMock.mockResolvedValue({
      id: 'post-1',
      deletedAt: null,
      channel: { groupId: 'group-1' },
    });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    addMock.mockResolvedValue({
      id: 'reaction-1',
      postId: 'post-1',
      userId: 'user-1',
      emoji: '👍',
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/posts/post-1/reactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });

    expect(response.status).toBe(201);
    expect(addMock).toHaveBeenCalledWith('post-1', 'user-1', '👍');
  });

  it('POST /posts/:id/reactions renvoie 400 pour un emoji vide', async () => {
    findPostMock.mockResolvedValue({
      id: 'post-1',
      deletedAt: null,
      channel: { groupId: 'group-1' },
    });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/posts/post-1/reactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '' });

    expect(response.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it('DELETE /posts/:id/reactions/:emoji retire la réaction du user courant', async () => {
    findPostMock.mockResolvedValue({
      id: 'post-1',
      deletedAt: null,
      channel: { groupId: 'group-1' },
    });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    removeMock.mockResolvedValue(undefined);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .delete('/posts/post-1/reactions/%F0%9F%91%8D')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(removeMock).toHaveBeenCalledWith('post-1', 'user-1', '👍');
  });
});
