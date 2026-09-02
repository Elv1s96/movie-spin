import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovieDto, UpdateMovieDto } from './dto/movie.dto';

// Поля, які віддаємо по публічному посиланню. userId свідомо не віддаємо —
// гостю він ні до чого, а зайвий ідентифікатор власника назовні не потрібен.
const PUBLIC_MOVIE_SELECT = {
  id: true,
  title: true,
  description: true,
  imdbRating: true,
  posterUrl: true,
  year: true,
  genres: true,
  watched: true,
  watchedAt: true,
  createdAt: true,
} as const;

export interface ImportResult {
  created: number;
  skipped: number;
  genresAdded: number;
}

export interface ShareInfo {
  token: string | null;
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

  // Бібліотека: без «своїх слів» з коліс — вони не фільми й живуть лише в колесі.
  findAll(userId: string) {
    return this.prisma.movie.findMany({
      where: { userId, isCustom: false },
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

  // ── Публічне посилання на бібліотеку ──────────────────────────────────────
  // Один токен на користувача: створення повторно — це перевипуск (старе
  // посилання одразу перестає працювати), видалення — відкликання.

  async getShare(userId: string): Promise<ShareInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shareToken: true },
    });
    return { token: user?.shareToken ?? null };
  }

  async createShare(userId: string): Promise<ShareInfo> {
    const token = randomBytes(24).toString('base64url');
    await this.prisma.user.update({
      where: { id: userId },
      data: { shareToken: token },
    });
    return { token };
  }

  async revokeShare(userId: string): Promise<ShareInfo> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { shareToken: null },
    });
    return { token: null };
  }

  // Читання бібліотеки по токену — єдиний вхід для незалогіненого гостя.
  // Порожній токен ніколи не має збігатися з NULL у базі, тому перевіряємо явно.
  async findAllByShareToken(token: string) {
    if (!token) throw new NotFoundException('Посилання недійсне');
    const owner = await this.prisma.user.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });
    if (!owner) throw new NotFoundException('Посилання недійсне або відкликане');

    const movies = await this.prisma.movie.findMany({
      where: { userId: owner.id, isCustom: false },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_MOVIE_SELECT,
    });
    // ownerId потрібен контролеру, щоб домішати стан пропонування; назовні
    // він не йде — у відповідь контролер кладе лише movies + suggest.
    return { ownerId: owner.id, movies };
  }
}
