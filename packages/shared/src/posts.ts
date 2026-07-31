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

// Union des types de post supportés côté API. `memes` rejoindra l'union en
// M5-T2.
export type PostDto = TextPostDto | WordEntryPostDto;

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

// Requête générique de création de post : le champ pertinent dépend du
// `type` réel du salon ciblé, résolu côté serveur.
export type CreatePostRequestDto = CreateTextPostRequestDto | CreateWordEntryRequestDto;

export interface PostsPageDto {
  posts: PostDto[];
  nextCursor: string | null;
}
