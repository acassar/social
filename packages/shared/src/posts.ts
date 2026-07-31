import type { NativeLang } from './auth';
import type { PostSummaryDto } from './realtime-events';

// Contenu typé pour un post de salon `text` (voir doc/SPEC.md §4, table
// `text_messages`). Étend la spine commune définie dans realtime-events.ts.
export interface TextPostDto extends PostSummaryDto {
  type: 'text';
  body: string;
}

// Contenu typé pour un post de salon `word_of_day` (M4-T1, table
// `word_entries`) : un mot posté dans sa langue, sa traduction, et une note
// libre optionnelle.
export interface WordEntryPostDto extends PostSummaryDto {
  type: 'word_of_day';
  term: string;
  lang: NativeLang;
  translation: string;
  note: string | null;
}

// Fichier attaché à un post `memes` (voir doc/SPEC.md §4, table `attachments`).
// Produit par `POST /uploads` (M5-T1) puis référencé tel quel à la création
// du post (M5-T2) — pas de re-upload, juste la métadonnée déjà connue.
export interface AttachmentDto {
  url: string;
  thumbUrl: string | null;
  mime: string;
  width: number | null;
  height: number | null;
}

// Contenu typé pour un post de salon `memes` (M5-T2) : une image/gif
// (`attachments`) avec une légende optionnelle (réutilise `text_messages`,
// décision actée en SPEC.md §4).
export interface MemePostDto extends PostSummaryDto {
  type: 'memes';
  attachment: AttachmentDto;
  caption: string | null;
}

// Union des types de post supportés côté API.
export type PostDto = TextPostDto | WordEntryPostDto | MemePostDto;

export interface CreateTextPostRequestDto {
  body: string;
}

export interface UpdateTextPostRequestDto {
  body: string;
}

export interface CreateWordEntryRequestDto {
  term: string;
  lang: NativeLang;
  translation: string;
  note?: string;
}

// Reprend tel quel le résultat de `POST /uploads` (M5-T1) : le front uploade
// d'abord le fichier, puis crée le post avec cette métadonnée + une légende
// optionnelle.
export interface CreateMemePostRequestDto {
  url: string;
  thumbUrl?: string;
  mime: string;
  width?: number;
  height?: number;
  caption?: string;
}

// Requête générique de création de post : le champ pertinent dépend du
// `type` réel du salon ciblé, résolu côté serveur.
export type CreatePostRequestDto =
  | CreateTextPostRequestDto
  | CreateWordEntryRequestDto
  | CreateMemePostRequestDto;

export interface PostsPageDto {
  posts: PostDto[];
  nextCursor: string | null;
}
