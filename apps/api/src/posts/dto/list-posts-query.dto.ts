import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Pagination par curseur sur `posts.created_at`, ordre chronologique
// (voir doc/BACKLOG.md M3-T1) : `cursor` est l'id du dernier post reçu,
// la page suivante renvoie les posts créés après lui.
export class ListPostsQueryDto {
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
