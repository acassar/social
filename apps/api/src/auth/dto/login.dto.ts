import { IsString, MinLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class LoginDto {
  @Trim()
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
