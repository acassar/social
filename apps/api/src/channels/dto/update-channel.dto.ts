import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { CHANNEL_TYPES, type ChannelType } from '@social/shared';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(CHANNEL_TYPES)
  type?: ChannelType;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
