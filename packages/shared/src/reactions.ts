// Requête de création d'une réaction emoji sur un post (M3-T2). Le DTO de
// sortie (`ReactionDto`) est déjà défini dans realtime-events.ts, réutilisé
// par le contrat d'événements temps réel `reaction:added`.
export interface CreateReactionRequestDto {
  emoji: string;
}
