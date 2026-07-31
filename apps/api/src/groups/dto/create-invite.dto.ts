import { IsISO8601, IsOptional } from 'class-validator';

export class CreateInviteDto {
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
