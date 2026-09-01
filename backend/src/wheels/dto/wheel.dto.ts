import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWheelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class UpdateWheelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

// Додати позицію: або фільм з бібліотеки (movieId), або довільне слово (title).
export class AddItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  movieId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;
}

export class UpdateItemWeightDto {
  @IsNumber()
  @Min(0)
  weight!: number;
}

// Спін: опційно обмежити вибір переможця конкретними позиціями (режим «на
// вибування» надсилає id ще активних позицій). Порожньо/відсутньо → усі позиції.
export class SpinDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}
