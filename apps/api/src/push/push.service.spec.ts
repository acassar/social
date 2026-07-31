jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const setVapidDetails = jest.fn();
const sendNotification = jest.fn();
jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

import type { ConfigService } from '@nestjs/config';
import type { PostDto } from '@social/shared';
import type { EnvironmentVariables } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

function configServiceMock(
  overrides: Partial<
    Record<'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT', string | null>
  > = {},
): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, string | null> = {
    VAPID_PUBLIC_KEY: 'pub',
    VAPID_PRIVATE_KEY: 'priv',
    VAPID_SUBJECT: 'mailto:admin@example.com',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
}

const TEXT_POST: PostDto = {
  id: 'post-1',
  channelId: 'channel-1',
  authorId: 'author-1',
  type: 'text',
  body: 'salut',
  createdAt: '2026-07-31T00:00:00.000Z',
  editedAt: null,
  deletedAt: null,
};

describe('PushService.subscribe / unsubscribe', () => {
  beforeEach(() => {
    setVapidDetails.mockReset();
    sendNotification.mockReset();
  });

  it('crée ou met à jour un abonnement par endpoint (upsert)', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prismaMock = { pushSubscription: { upsert } };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    await service.subscribe('user-1', 'https://push.example/ep', { p256dh: 'p', auth: 'a' });

    expect(upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/ep' },
      update: { userId: 'user-1', p256dh: 'p', auth: 'a' },
      create: { userId: 'user-1', endpoint: 'https://push.example/ep', p256dh: 'p', auth: 'a' },
    });
  });

  it('supprime un abonnement scopé à son propriétaire', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaMock = { pushSubscription: { deleteMany } };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    await service.unsubscribe('user-1', 'https://push.example/ep');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', endpoint: 'https://push.example/ep' },
    });
  });
});

describe('PushService — préférences par salon', () => {
  it("getChannelPreference renvoie enabled: false quand aucune ligne n'existe", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prismaMock = { channelNotificationPreference: { findUnique } };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    const result = await service.getChannelPreference('channel-1', 'user-1');

    expect(result).toEqual({ channelId: 'channel-1', enabled: false });
  });

  it('getChannelPreference renvoie enabled: true quand une ligne existe', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'pref-1' });
    const prismaMock = { channelNotificationPreference: { findUnique } };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    const result = await service.getChannelPreference('channel-1', 'user-1');

    expect(result).toEqual({ channelId: 'channel-1', enabled: true });
  });

  it('enableChannelPreference est idempotent (upsert)', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prismaMock = { channelNotificationPreference: { upsert } };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    const result = await service.enableChannelPreference('channel-1', 'user-1');

    expect(upsert).toHaveBeenCalledWith({
      where: { channelId_userId: { channelId: 'channel-1', userId: 'user-1' } },
      update: {},
      create: { channelId: 'channel-1', userId: 'user-1' },
    });
    expect(result).toEqual({ channelId: 'channel-1', enabled: true });
  });

  it('disableChannelPreference supprime la ligne (idempotent)', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const prismaMock = { channelNotificationPreference: { deleteMany } };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    await service.disableChannelPreference('channel-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { channelId: 'channel-1', userId: 'user-1' },
    });
  });
});

describe('PushService.notifyChannelPost', () => {
  it("n'envoie rien si les clés VAPID ne sont pas configurées", async () => {
    const findMany = jest.fn();
    const prismaMock = { channelNotificationPreference: { findMany } };
    const service = new PushService(
      prismaMock as unknown as PrismaService,
      configServiceMock({ VAPID_PUBLIC_KEY: null, VAPID_PRIVATE_KEY: null }),
    );

    await service.notifyChannelPost('channel-1', 'author-1', TEXT_POST);

    expect(findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("n'envoie rien si personne n'a opt-in sur ce salon", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findUniqueChannel = jest.fn();
    const prismaMock = {
      channelNotificationPreference: { findMany },
      channel: { findUnique: findUniqueChannel },
    };
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    await service.notifyChannelPost('channel-1', 'author-1', TEXT_POST);

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("exclut l'auteur des destinataires et envoie aux abonnés opt-in", async () => {
    const findManyPrefs = jest.fn().mockResolvedValue([{ userId: 'reader-1' }]);
    const findUniqueChannel = jest.fn().mockResolvedValue({ name: 'général' });
    const findManySubs = jest
      .fn()
      .mockResolvedValue([{ endpoint: 'https://push.example/ep', p256dh: 'p', auth: 'a' }]);
    const prismaMock = {
      channelNotificationPreference: { findMany: findManyPrefs },
      channel: { findUnique: findUniqueChannel },
      pushSubscription: { findMany: findManySubs },
    };
    sendNotification.mockResolvedValue(undefined);
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    await service.notifyChannelPost('channel-1', 'author-1', TEXT_POST);

    expect(findManyPrefs).toHaveBeenCalledWith({
      where: { channelId: 'channel-1', userId: { not: 'author-1' } },
      select: { userId: true },
    });
    expect(findManySubs).toHaveBeenCalledWith({ where: { userId: { in: ['reader-1'] } } });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscriptionArg, payloadArg] = sendNotification.mock.calls[0];
    expect(subscriptionArg).toEqual({
      endpoint: 'https://push.example/ep',
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(JSON.parse(payloadArg as string)).toEqual({
      title: 'général',
      body: 'salut',
      channelId: 'channel-1',
    });
  });

  it('retire un abonnement expiré (410) sans faire échouer les autres envois', async () => {
    const findManyPrefs = jest.fn().mockResolvedValue([{ userId: 'reader-1' }]);
    const findUniqueChannel = jest.fn().mockResolvedValue({ name: 'général' });
    const findManySubs = jest
      .fn()
      .mockResolvedValue([{ endpoint: 'https://push.example/gone', p256dh: 'p', auth: 'a' }]);
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prismaMock = {
      channelNotificationPreference: { findMany: findManyPrefs },
      channel: { findUnique: findUniqueChannel },
      pushSubscription: { findMany: findManySubs, deleteMany },
    };
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const service = new PushService(prismaMock as unknown as PrismaService, configServiceMock());

    await service.notifyChannelPost('channel-1', 'author-1', TEXT_POST);

    expect(deleteMany).toHaveBeenCalledWith({ where: { endpoint: 'https://push.example/gone' } });
  });
});
