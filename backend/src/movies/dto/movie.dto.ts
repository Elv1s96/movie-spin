import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMovieDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  imdbRating?: number;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsBoolean()
  watched?: boolean;

  @IsOptional()
  @IsISO8601()
  watchedAt?: string | null;
}

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  imdbRating?: number;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsBoolean()
  watched?: boolean;

  @IsOptional()
  @IsISO8601()
  watchedAt?: string | null;
}

// Масовий імпорт із JSON-файлу: { "movies": [ { …CreateMovieDto }, … ] }.
export class ImportMoviesDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateMovieDto)
  movies!: CreateMovieDto[];
}
