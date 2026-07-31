import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelNotificationPreferenceDto, PostDto } from '@social/shared';
import webpush from 'web-push';
import type { EnvironmentVariables } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function previewFor(post: PostDto): string {
  if (post.type === 'text') {
    return post.body.length > 120 ? `${post.body.slice(0, 117)}...` : post.body;
  }
  if (post.type === 'word_of_day') {
    return `${post.term} → ${post.translation}`;
  }
  return post.caption ?? 'Nouveau mème';
}

// Web Push (M6-T2, VAPID) : envoie une notification aux users qui ont opt-in
// sur le salon d'un post nouvellement créé (jamais de relance à publier —
// voir doc/SPEC.md §8/§9). Sans clés VAPID configurées (dev par défaut),
// l'opt-in reste utilisable mais aucun envoi n'est tenté.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const publicKey = configService.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = configService.get('VAPID_PRIVATE_KEY', { infer: true });
    const subject = configService.get('VAPID_SUBJECT', { infer: true });

    this.vapidConfigured = Boolean(publicKey && privateKey);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey as string, privateKey as string);
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY absents : envoi de push désactivé');
    }
  }

  async subscribe(
    userId: string,
    endpoint: string,
    keys: { p256dh: string; auth: string },
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async getChannelPreference(
    channelId: string,
    userId: string,
  ): Promise<ChannelNotificationPreferenceDto> {
    const existing = await this.prisma.channelNotificationPreference.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    return { channelId, enabled: existing !== null };
  }

  async enableChannelPreference(
    channelId: string,
    userId: string,
  ): Promise<ChannelNotificationPreferenceDto> {
    await this.prisma.channelNotificationPreference.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: {},
      create: { channelId, userId },
    });
    return { channelId, enabled: true };
  }

  async disableChannelPreference(channelId: string, userId: string): Promise<void> {
    await this.prisma.channelNotificationPreference.deleteMany({ where: { channelId, userId } });
  }

  // Appelé par PostsService après création d'un post (fire-and-forget, ne
  // doit jamais faire échouer la création du post elle-même).
  async notifyChannelPost(channelId: string, authorId: string, post: PostDto): Promise<void> {
    if (!this.vapidConfigured) {
      return;
    }

    try {
      const [preferences, channel] = await Promise.all([
        this.prisma.channelNotificationPreference.findMany({
          where: { channelId, userId: { not: authorId } },
          select: { userId: true },
        }),
        this.prisma.channel.findUnique({ where: { id: channelId }, select: { name: true } }),
      ]);
      if (preferences.length === 0) {
        return;
      }

      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId: { in: preferences.map((p) => p.userId) } },
      });
      if (subscriptions.length === 0) {
        return;
      }

      const payload = JSON.stringify({
        title: channel?.name ?? 'Nouveau post',
        body: previewFor(post),
        channelId,
      });

      await Promise.all(subscriptions.map((sub) => this.send(sub, payload)));
    } catch (error) {
      this.logger.warn(`Échec de l'envoi des notifications du salon ${channelId}`, error as Error);
    }
  }

  private async send(subscription: SubscriptionRow, payload: string): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      );
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Abonnement expiré/révoqué côté navigateur : on le retire.
        await this.prisma.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        });
        return;
      }
      this.logger.warn(`Échec d'envoi vers ${subscription.endpoint}`, error as Error);
    }
  }
}
