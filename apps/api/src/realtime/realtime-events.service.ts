import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  REALTIME_EVENTS,
  type PostCreatedEvent,
  type PostDeletedEvent,
  type PostUpdatedEvent,
  type ReactionAddedEvent,
  type ReactionRemovedEvent,
  type RealtimeEventPayloadMap,
} from '@social/shared';
import { channelRoom } from './rooms';

/**
 * Émetteur central des événements temps réel (M2-T3). Les modules métier
 * (posts, réactions, ...) l'appellent après écriture ; le gateway ne fait
 * que router la connexion (join des rooms), aucune logique métier n'y vit.
 */
@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  emitToRoom<Event extends keyof RealtimeEventPayloadMap>(
    room: string,
    event: Event,
    payload: RealtimeEventPayloadMap[Event],
  ): void {
    if (!this.server) {
      this.logger.warn(`Serveur Socket.io non initialisé, événement ${event} ignoré`);
      return;
    }
    this.server.to(room).emit(event, payload);
  }

  private emitToChannel<Event extends keyof RealtimeEventPayloadMap>(
    channelId: string,
    event: Event,
    payload: RealtimeEventPayloadMap[Event],
  ): void {
    this.emitToRoom(channelRoom(channelId), event, payload);
  }

  emitPostCreated(channelId: string, payload: PostCreatedEvent): void {
    this.emitToChannel(channelId, REALTIME_EVENTS.POST_CREATED, payload);
  }

  emitPostUpdated(channelId: string, payload: PostUpdatedEvent): void {
    this.emitToChannel(channelId, REALTIME_EVENTS.POST_UPDATED, payload);
  }

  emitPostDeleted(channelId: string, payload: PostDeletedEvent): void {
    this.emitToChannel(channelId, REALTIME_EVENTS.POST_DELETED, payload);
  }

  emitReactionAdded(channelId: string, payload: ReactionAddedEvent): void {
    this.emitToChannel(channelId, REALTIME_EVENTS.REACTION_ADDED, payload);
  }

  emitReactionRemoved(channelId: string, payload: ReactionRemovedEvent): void {
    this.emitToChannel(channelId, REALTIME_EVENTS.REACTION_REMOVED, payload);
  }
}
