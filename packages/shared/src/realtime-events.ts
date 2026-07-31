import type { ChannelType } from './channels';
import type { TextPostDto } from './posts';

export const REALTIME_EVENTS = {
  POST_CREATED: 'post:created',
  POST_UPDATED: 'post:updated',
  POST_DELETED: 'post:deleted',
  REACTION_ADDED: 'reaction:added',
  REACTION_REMOVED: 'reaction:removed',
  PRESENCE_UPDATE: 'presence:update',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// Spine commune à tous les types de post (voir doc/SPEC.md §4). Le contenu
// typé (text_messages / word_entries / attachments) n'est pas encore modélisé
// côté API (M3+) ; il rejoindra ce contrat au fur et à mesure de son implémentation.
export interface PostSummaryDto {
  id: string;
  channelId: string;
  authorId: string;
  type: ChannelType;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

// Le contenu typé rejoint le contrat au fur et à mesure de son implémentation
// (voir le commentaire sur PostSummaryDto) : M3-T1 l'étend avec TextPostDto ;
// M4-T1/M5-T2 l'étendront à leur tour pour les autres types de post.
export interface PostCreatedEvent {
  post: TextPostDto;
}

export interface PostUpdatedEvent {
  post: TextPostDto;
}

export interface PostDeletedEvent {
  postId: string;
  channelId: string;
}

export interface ReactionDto {
  id: string;
  postId: string;
  userId: string;
  emoji: string;
}

export interface ReactionAddedEvent {
  reaction: ReactionDto;
}

export interface ReactionRemovedEvent {
  postId: string;
  userId: string;
  emoji: string;
}

export type PresenceStatus = 'online' | 'offline';

export interface PresenceUpdateEvent {
  groupId: string;
  userId: string;
  status: PresenceStatus;
}

export interface RealtimeEventPayloadMap {
  [REALTIME_EVENTS.POST_CREATED]: PostCreatedEvent;
  [REALTIME_EVENTS.POST_UPDATED]: PostUpdatedEvent;
  [REALTIME_EVENTS.POST_DELETED]: PostDeletedEvent;
  [REALTIME_EVENTS.REACTION_ADDED]: ReactionAddedEvent;
  [REALTIME_EVENTS.REACTION_REMOVED]: ReactionRemovedEvent;
  [REALTIME_EVENTS.PRESENCE_UPDATE]: PresenceUpdateEvent;
}
