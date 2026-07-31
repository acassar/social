// Nommage des rooms Socket.io, isolé de la gateway : `RealtimeEventsService`
// et `RealtimeGateway` en ont tous deux besoin, et les faire dépendre l'un de
// l'autre créait un cycle d'imports qui casse l'évaluation des métadonnées de
// décorateur (`design:paramtypes`) au chargement du module.
export function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}
