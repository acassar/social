import { IsIn, IsString, MinLength } from 'class-validator';
import type { NativeLang } from '@social/shared';
import { Trim } from '../../common/trim.decorator';

const NATIVE_LANGS: NativeLang[] = ['fr', 'de'];

export class RegisterDto {
  @Trim()
  @IsString()
  @MinLength(1)
  inviteCode!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsIn(NATIVE_LANGS)
  nativeLang!: NativeLang;

  @IsString()
  @MinLength(8)
  password!: string;
}
