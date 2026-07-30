import { IsString, MinLength } from 'class-validator';

export class CreateTextPostDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
