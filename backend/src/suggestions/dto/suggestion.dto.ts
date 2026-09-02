import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Дзеркало SessionOptions для валідації тіла запиту. Усі поля необов'язкові —
// відсутнє означає «дефолт» (див. normalizeOptions).
export class SessionOptionsDto {
  @IsOptional()
  @IsBoolean()
  askName?: boolean;

  @IsOptional()
  @IsBoolean()
  requireName?: boolean;
}

// Запуск сесії: або колесо, яке вже є (wheelId), або нове за назвою (wheelName).
export class StartSessionDto {
  @IsOptional()
  @IsString()
  wheelId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  wheelName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionOptionsDto)
  options?: SessionOptionsDto;
}

// Пропозиція від гостя: тільки фільм із бібліотеки власника.
export class SuggestDto {
  @IsString()
  @MinLength(1)
  movieId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestName?: string;
}
