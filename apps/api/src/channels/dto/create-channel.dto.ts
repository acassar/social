import { IsIn, IsInt, IsString, Min, MinLength } from 'class-validator';
import { CHANNEL_TYPES, type ChannelType } from '@social/shared';

export class CreateChannelDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(CHANNEL_TYPES)
  type!: ChannelType;

  @IsInt()
  @Min(0)
  position!: number;
}
