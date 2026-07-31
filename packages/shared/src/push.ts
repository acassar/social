// Web Push (VAPID), opt-in par salon (M6-T2, voir doc/SPEC.md §8/§9). Deux
// notions distinctes : l'abonnement Push du navigateur (un par appareil,
// table `push_subscriptions`) et le réglage « je veux être notifié dans ce
// salon » (par user + salon, désactivé par défaut — jamais de forcing).

export interface PushSubscriptionKeysDto {
  p256dh: string;
  auth: string;
}

// Reprend la forme native de `PushSubscription.toJSON()` côté navigateur.
export interface SubscribePushRequestDto {
  endpoint: string;
  keys: PushSubscriptionKeysDto;
}

export interface UnsubscribePushRequestDto {
  endpoint: string;
}

export interface ChannelNotificationPreferenceDto {
  channelId: string;
  enabled: boolean;
}
