import { IsIn, IsString, MinLength } from 'class-validator';
import type { NativeLang } from '@social/shared';

const NATIVE_LANGS: NativeLang[] = ['fr', 'de'];

export class RegisterDto {
  @IsString()
  @MinLength(1)
  inviteCode!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsIn(NATIVE_LANGS)
  nativeLang!: NativeLang;

  @IsString()
  @MinLength(8)
  password!: string;
}
