import type { NativeLang } from './auth';
import type { WordEntryPostDto } from './posts';

// Vue dérivée en lecture des `word_entries` d'un group (M4-T3, voir
// doc/BACKLOG.md) : aucune nouvelle table, mêmes champs qu'un post
// `word_of_day` (voir posts.ts).
export type GlossaryEntryDto = WordEntryPostDto;

export interface GlossaryPageDto {
  entries: GlossaryEntryDto[];
  nextCursor: string | null;
}

export interface GlossaryQueryDto {
  lang?: NativeLang;
  search?: string;
  cursor?: string;
  limit?: number;
}
