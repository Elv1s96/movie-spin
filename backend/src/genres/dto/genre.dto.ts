import { IsString, MinLength } from 'class-validator';

export class CreateGenreDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class RenameGenreDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
