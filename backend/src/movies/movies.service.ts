import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovieDto, UpdateMovieDto } from './dto/movie.dto';

export interface ImportResult {
  created: number;
  skipped: number;
  genresAdded: number;
}

@Injectable()
export class MoviesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwned(movieId: string, userId: string) {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new NotFoundException('Фільм не знайдено');
    if (movie.userId !== userId) throw new ForbiddenException();
    return movie;
  }

  findAll(userId: string) {
    return this.prisma.movie.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateMovieDto) {
    return this.prisma.movie.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        imdbRating: dto.imdbRating,
        posterUrl: dto.posterUrl,
        year: dto.year,
        genres: dto.genres ?? [],
        watched: dto.watched ?? false,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : null,
      },
    });
  }

  // Масовий імпорт із JSON. Фільми без назви пропускаємо; усі жанри з імпорту
  // додаємо в каталог користувача (skipDuplicates — уже наявні не дублюються).
  async importMany(userId: string, items: CreateMovieDto[]): Promise<ImportResult> {
    const clean = items.filter((m) => m.title && m.title.trim());
    const skipped = items.length - clean.length;
    if (!clean.length) return { created: 0, skipped, genresAdded: 0 };

    await this.prisma.movie.createMany({
      data: clean.map((dto) => ({
        userId,
        title: dto.title.trim(),
        description: dto.description,
        imdbRating: dto.imdbRating,
        posterUrl: dto.posterUrl,
        year: dto.year,
        genres: (dto.genres ?? []).map((g) => g.trim()).filter(Boolean),
        watched: dto.watched ?? false,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : null,
      })),
    });

    const names = [
      ...new Set(
        clean.flatMap((m) => (m.genres ?? []).map((g) => g.trim()).filter(Boolean)),
      ),
    ];
    let genresAdded = 0;
    if (names.length) {
      const res = await this.prisma.genre.createMany({
        data: names.map((name) => ({ userId, name })),
        skipDuplicates: true,
      });
      genresAdded = res.count;
    }

    return { created: clean.length, skipped, genresAdded };
  }

  async update(movieId: string, userId: string, dto: UpdateMovieDto) {
    await this.assertOwned(movieId, userId);
    return this.prisma.movie.update({
      where: { id: movieId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imdbRating !== undefined ? { imdbRating: dto.imdbRating } : {}),
        ...(dto.posterUrl !== undefined ? { posterUrl: dto.posterUrl } : {}),
        ...(dto.year !== undefined ? { year: dto.year } : {}),
        ...(dto.genres !== undefined ? { genres: dto.genres } : {}),
        ...(dto.watched !== undefined ? { watched: dto.watched } : {}),
        ...(dto.watchedAt !== undefined
          ? { watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : null }
          : {}),
      },
    });
  }

  async remove(movieId: string, userId: string) {
    await this.assertOwned(movieId, userId);
    await this.prisma.movie.delete({ where: { id: movieId } });
    return { ok: true };
  }
}
