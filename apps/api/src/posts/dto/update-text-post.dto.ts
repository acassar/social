import { IsString, MinLength } from 'class-validator';

export class UpdateTextPostDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
