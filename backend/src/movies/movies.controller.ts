import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { MoviesService } from './movies.service';
import { CreateMovieDto, UpdateMovieDto, ImportMoviesDto } from './dto/movie.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('movies')
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.movies.findAll(user.id);
  }

  // ── Публічне посилання на бібліотеку ──────────────────────────────────────
  // УВАГА: ці три маршрути мають лишатися ВИЩЕ за generic-маршрути з :id,
  // інакше Nest зматчить DELETE /movies/share як видалення фільму з id="share".

  @Get('share')
  getShare(@CurrentUser() user: AuthUser) {
    return this.movies.getShare(user.id);
  }

  // Повторний виклик перевипускає токен — старе посилання перестає працювати.
  @Post('share')
  createShare(@CurrentUser() user: AuthUser) {
    return this.movies.createShare(user.id);
  }

  @Delete('share')
  revokeShare(@CurrentUser() user: AuthUser) {
    return this.movies.revokeShare(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMovieDto) {
    return this.movies.create(user.id, dto);
  }

  // Масовий імпорт із JSON-файлу.
  @Post('import')
  importMany(@CurrentUser() user: AuthUser, @Body() dto: ImportMoviesDto) {
    return this.movies.importMany(user.id, dto.movies);
  }

  // Завантаження постера-картинки. Повертає URL, який кладеться у posterUrl.
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
      fileFilter: (_req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Дозволені лише зображення'), false);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не отримано');
    return { url: `/uploads/${file.filename}` };
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMovieDto,
  ) {
    return this.movies.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.movies.remove(id, user.id);
  }
}
