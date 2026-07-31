import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import type { NativeLang } from '@social/shared';

// Un seul endpoint (`POST /channels/:id/posts`) accueille tous les types de
// post (M4-T1) : le champ pertinent dépend du type réel du salon ciblé,
// résolu par PostsService. `body` est requis pour un salon `text` ;
// `term`/`lang`/`translation` pour un salon `word_of_day` (`note` optionnelle).
export class CreatePostDto {
  @ValidateIf((dto: CreatePostDto) => dto.term === undefined)
  @IsString()
  @MinLength(1)
  body?: string;

  @ValidateIf((dto: CreatePostDto) => dto.body === undefined)
  @IsString()
  @MinLength(1)
  term?: string;

  @ValidateIf((dto: CreatePostDto) => dto.body === undefined)
  @IsIn(['fr', 'de'])
  lang?: NativeLang;

  @ValidateIf((dto: CreatePostDto) => dto.body === undefined)
  @IsString()
  @MinLength(1)
  translation?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
