import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.genre.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  // Створюємо жанр у каталозі. Якщо такий уже є (унікальність userId+name),
  // просто повертаємо наявний — форма може «додати» той самий жанр повторно.
  async create(userId: string, rawName: string) {
    const name = rawName.trim();
    if (!name) throw new ForbiddenException('Порожня назва жанру');
    const existing = await this.prisma.genre.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) return existing;
    return this.prisma.genre.create({ data: { userId, name } });
  }

  private async assertOwned(id: string, userId: string) {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new NotFoundException('Жанр не знайдено');
    if (genre.userId !== userId) throw new ForbiddenException();
    return genre;
  }

  // Перейменування каскадно оновлює рядки genres у всіх фільмах користувача.
  // Якщо цільова назва вже існує в каталозі — зливаємо (стару запис видаляємо).
  async rename(id: string, userId: string, rawName: string) {
    const genre = await this.assertOwned(id, userId);
    const name = rawName.trim();
    if (!name || name === genre.name) return genre;

    const clash = await this.prisma.genre.findUnique({
      where: { userId_name: { userId, name } },
    });

    await this.replaceInMovies(userId, genre.name, name);

    if (clash && clash.id !== id) {
      // Злиття: лишаємо існуючий запис, стару позицію прибираємо.
      await this.prisma.genre.delete({ where: { id } });
      return clash;
    }
    return this.prisma.genre.update({ where: { id }, data: { name } });
  }

  async remove(id: string, userId: string) {
    const genre = await this.assertOwned(id, userId);
    await this.replaceInMovies(userId, genre.name, null);
    await this.prisma.genre.delete({ where: { id } });
    return { ok: true };
  }

  // Замінює (або прибирає, якщо to === null) назву жанру в масивах genres
  // усіх фільмів користувача, що його містять. Дублікати згортаються.
  private async replaceInMovies(userId: string, from: string, to: string | null) {
    const movies = await this.prisma.movie.findMany({
      where: { userId, genres: { has: from } },
      select: { id: true, genres: true },
    });
    for (const m of movies) {
      const next = m.genres.map((g) => (g === from ? to : g)).filter((g): g is string => !!g);
      const deduped = [...new Set(next)];
      await this.prisma.movie.update({
        where: { id: m.id },
        data: { genres: deduped },
      });
    }
  }
}
