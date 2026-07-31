import { IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';
import { ALLOWED_UPLOAD_MIME_TYPES, type AllowedUploadMimeType } from '@social/shared';
import type { NativeLang } from '@social/shared';

// Un seul endpoint (`POST /channels/:id/posts`) accueille tous les types de
// post : le champ pertinent dépend du type réel du salon ciblé, résolu par
// PostsService, qui applique aussi le caractère requis des champs par type
// (`body` pour `text`, `term`/`lang`/`translation` pour `word_of_day`,
// `url`/`mime` pour `memes` — M5-T2). Ici, on ne valide que le *format* des
// champs présents ; `body` sert aussi de légende optionnelle pour `memes`.
export class CreatePostDto {
  @ValidateIf((dto: CreatePostDto) => dto.term === undefined && dto.url === undefined)
  @IsString()
  @MinLength(1)
  body?: string;

  @ValidateIf((dto: CreatePostDto) => dto.body === undefined && dto.url === undefined)
  @IsString()
  @MinLength(1)
  term?: string;

  @ValidateIf((dto: CreatePostDto) => dto.body === undefined && dto.url === undefined)
  @IsIn(['fr', 'de'])
  lang?: NativeLang;

  @ValidateIf((dto: CreatePostDto) => dto.body === undefined && dto.url === undefined)
  @IsString()
  @MinLength(1)
  translation?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  thumbUrl?: string;

  @IsOptional()
  @IsIn(ALLOWED_UPLOAD_MIME_TYPES)
  mime?: AllowedUploadMimeType;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}
