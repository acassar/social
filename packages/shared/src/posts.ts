import type { PostSummaryDto } from './realtime-events';

// Contenu typé pour un post de salon `text` (voir doc/SPEC.md §4, table
// `text_messages`). Étend la spine commune définie dans realtime-events.ts —
// les types `word_of_day`/`memes` l'étendront à leur tour (M4-T1, M5-T2).
export interface TextPostDto extends PostSummaryDto {
  body: string;
}

export interface CreateTextPostRequestDto {
  body: string;
}

export interface UpdateTextPostRequestDto {
  body: string;
}

export interface PostsPageDto {
  posts: TextPostDto[];
  nextCursor: string | null;
}
