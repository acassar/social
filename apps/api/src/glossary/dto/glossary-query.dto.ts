import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { NativeLang } from '@social/shared';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Filtre/pagination du glossaire (M4-T3) : `lang` restreint fr/de, `search`
// filtre sur `term`/`translation` (insensible à la casse), `cursor`/`limit`
// paginent comme `GET /channels/:id/posts` (voir ListPostsQueryDto).
export class GlossaryQueryDto {
  @IsOptional()
  @IsIn(['fr', 'de'])
  lang?: NativeLang;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
