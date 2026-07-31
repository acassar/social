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
import { ChannelMemberGuard } from '../channels/channel-member.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

const ACCESS_SECRET = 'access-secret';

describe('PostsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const createMock = jest.fn();
  const listMock = jest.fn();
  const updateMock = jest.fn();
  const removeMock = jest.fn();
  const findChannelMock = jest.fn();
  const findMembershipMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: {
            create: createMock,
            list: listMock,
            update: updateMock,
            remove: removeMock,
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
    findChannelMock.mockReset();
    findMembershipMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('GET /channels/:id/posts renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer()).get('/channels/channel-1/posts');

    expect(response.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /channels/:id/posts renvoie 404 pour un salon inexistant', async () => {
    findChannelMock.mockResolvedValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/channels/channel-1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /channels/:id/posts renvoie 403 pour un non-membre', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue(null);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/channels/channel-1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('GET /channels/:id/posts liste les messages pour un membre', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    listMock.mockResolvedValue({ posts: [{ id: 'post-1', body: 'salut' }], nextCursor: null });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .get('/channels/channel-1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith('channel-1', undefined, 30);
    expect(response.body).toEqual({ posts: [{ id: 'post-1', body: 'salut' }], nextCursor: null });
  });

  it('GET /channels/:id/posts transmet cursor/limit', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    listMock.mockResolvedValue({ posts: [], nextCursor: null });
    const token = await accessTokenFor('user-1');

    await request(app.getHttpServer())
      .get('/channels/channel-1/posts?cursor=post-1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(listMock).toHaveBeenCalledWith('channel-1', 'post-1', 5);
  });

  it('POST /channels/:id/posts crée un message pour un membre', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    createMock.mockResolvedValue({
      id: 'post-1',
      channelId: 'channel-1',
      authorId: 'user-1',
      type: 'text',
      body: 'salut',
      createdAt: '2026-07-30T00:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'salut' });

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      'channel-1',
      'user-1',
      expect.objectContaining({ body: 'salut' }),
    );
  });

  it('POST /channels/:id/posts renvoie 400 pour un body vide', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '' });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('POST /channels/:id/posts crée une entrée de mot du jour (M4-T1)', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-2', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    createMock.mockResolvedValue({
      id: 'post-2',
      channelId: 'channel-2',
      authorId: 'user-1',
      type: 'word_of_day',
      term: 'Feierabend',
      lang: 'de',
      translation: 'fin de journée de travail',
      note: null,
      createdAt: '2026-07-31T00:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-2/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ term: 'Feierabend', lang: 'de', translation: 'fin de journée de travail' });

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      'channel-2',
      'user-1',
      expect.objectContaining({
        term: 'Feierabend',
        lang: 'de',
        translation: 'fin de journée de travail',
      }),
    );
  });

  it('POST /channels/:id/posts renvoie 400 pour une entrée de mot incomplète', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-2', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-2/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ term: 'Feierabend' });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('POST /channels/:id/posts renvoie 400 pour un lang invalide', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-2', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-2/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ term: 'Feierabend', lang: 'en', translation: 'x' });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('POST /channels/:id/posts crée un post mème (M5-T2)', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-3', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    createMock.mockResolvedValue({
      id: 'post-3',
      channelId: 'channel-3',
      authorId: 'user-1',
      type: 'memes',
      attachment: {
        url: '/uploads/abc.webp',
        thumbUrl: '/uploads/abc-thumb.webp',
        mime: 'image/webp',
        width: 800,
        height: 600,
      },
      caption: 'regardez ça',
      createdAt: '2026-07-31T00:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-3/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: '/uploads/abc.webp',
        thumbUrl: '/uploads/abc-thumb.webp',
        mime: 'image/webp',
        width: 800,
        height: 600,
        body: 'regardez ça',
      });

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      'channel-3',
      'user-1',
      expect.objectContaining({ url: '/uploads/abc.webp', mime: 'image/webp' }),
    );
  });

  it('POST /channels/:id/posts renvoie 400 pour un mime non supporté', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-3', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/channels/channel-3/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: '/uploads/abc.exe', mime: 'application/octet-stream' });

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('PATCH /channels/:id/posts/:postId met à jour le message', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    updateMock.mockResolvedValue({
      id: 'post-1',
      channelId: 'channel-1',
      authorId: 'user-1',
      type: 'text',
      body: 'coucou',
      createdAt: '2026-07-30T00:00:00.000Z',
      editedAt: '2026-07-30T00:05:00.000Z',
      deletedAt: null,
    });
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .patch('/channels/channel-1/posts/post-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'coucou' });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('channel-1', 'post-1', 'user-1', { body: 'coucou' });
  });

  it('DELETE /channels/:id/posts/:postId supprime le message', async () => {
    findChannelMock.mockResolvedValue({ id: 'channel-1', groupId: 'group-1' });
    findMembershipMock.mockResolvedValue({ role: 'member' });
    removeMock.mockResolvedValue(undefined);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .delete('/channels/channel-1/posts/post-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(removeMock).toHaveBeenCalledWith('channel-1', 'post-1', 'user-1');
  });
});
