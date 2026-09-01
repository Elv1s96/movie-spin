import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddItemDto, CreateWheelDto, UpdateWheelDto } from './dto/wheel.dto';

// Стабільний порядок секторів — фронт рендерить у цьому ж порядку, тож індекс
// переможця з бекенду однозначно вказує на сектор.
const ITEM_ORDER = { createdAt: 'asc' as const };

@Injectable()
export class WheelsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertWheelOwned(wheelId: string, userId: string) {
    const wheel = await this.prisma.wheel.findUnique({ where: { id: wheelId } });
    if (!wheel) throw new NotFoundException('Колесо не знайдено');
    if (wheel.userId !== userId) throw new ForbiddenException();
    return wheel;
  }

  private async assertMovieOwned(movieId: string, userId: string) {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new NotFoundException('Фільм не знайдено');
    if (movie.userId !== userId) throw new ForbiddenException();
    return movie;
  }

  /**
   * Список коліс користувача. Якщо передано movieId — до кожного колеса
   * додається прапорець hasMovie: чи вже є цей фільм на колесі (щоб у модалці
   * «додати в колесо» одразу було видно, куди фільм уже доданий).
   */
  async findAll(userId: string, movieId?: string) {
    const wheels = await this.prisma.wheel.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { items: true } },
        // Порожній movieId не збігається з жодним записом — items буде [].
        items: { where: { movieId: movieId ?? '' }, select: { id: true } },
      },
    });
    return wheels.map(({ items, ...wheel }) => ({
      ...wheel,
      hasMovie: items.length > 0,
    }));
  }

  async findOne(wheelId: string, userId: string) {
    await this.assertWheelOwned(wheelId, userId);
    return this.prisma.wheel.findUnique({
      where: { id: wheelId },
      include: { items: { orderBy: ITEM_ORDER, include: { movie: true } } },
    });
  }

  create(userId: string, dto: CreateWheelDto) {
    return this.prisma.wheel.create({ data: { name: dto.name, userId } });
  }

  async update(wheelId: string, userId: string, dto: UpdateWheelDto) {
    await this.assertWheelOwned(wheelId, userId);
    return this.prisma.wheel.update({
      where: { id: wheelId },
      data: { name: dto.name },
    });
  }

  async remove(wheelId: string, userId: string) {
    await this.assertWheelOwned(wheelId, userId);
    await this.prisma.wheel.delete({ where: { id: wheelId } });
    // Свої слова, що лишились без колеса й без історії, прибираємо.
    await this.prisma.movie.deleteMany({
      where: { userId, isCustom: true, items: { none: {} }, wins: { none: {} } },
    });
    return { ok: true };
  }

  // ── Позиції колеса (фільм з бібліотеки + вага) ──

  /**
   * Додає позицію в колесо (ідемпотентно): або фільм з бібліотеки (movieId),
   * або довільне слово (title) — під нього створюється прихований запис
   * Movie з isCustom, який у бібліотеці «Мої фільми» не показується.
   */
  async addItem(wheelId: string, userId: string, dto: AddItemDto) {
    await this.assertWheelOwned(wheelId, userId);

    const title = dto.title?.trim();
    let movieId = dto.movieId;

    if (movieId) {
      await this.assertMovieOwned(movieId, userId);
    } else if (title) {
      // Таке саме слово вже на колесі → повертаємо наявну позицію.
      const existing = await this.prisma.wheelItem.findFirst({
        where: { wheelId, movie: { title, isCustom: true } },
        include: { movie: true },
      });
      if (existing) return existing;

      const movie = await this.prisma.movie.create({
        data: { userId, title, isCustom: true },
      });
      movieId = movie.id;
    } else {
      throw new BadRequestException('Потрібен movieId або title');
    }

    const item = await this.prisma.wheelItem.upsert({
      where: { wheelId_movieId: { wheelId, movieId } },
      create: { wheelId, movieId, weight: dto.weight && dto.weight > 0 ? dto.weight : 1 },
      update: {},
      include: { movie: true },
    });
    await this.touch(wheelId);
    return item;
  }

  async removeItem(wheelId: string, itemId: string, userId: string) {
    await this.assertWheelOwned(wheelId, userId);
    const item = await this.prisma.wheelItem.delete({
      where: { id: itemId },
      include: { movie: true },
    });
    // Своє слово без інших колес і без згадок в історії — прибираємо з БД,
    // щоб приховані записи не накопичувались.
    if (item.movie.isCustom) {
      const [used, inHistory] = await Promise.all([
        this.prisma.wheelItem.count({ where: { movieId: item.movieId } }),
        this.prisma.spinHistory.count({ where: { movieId: item.movieId } }),
      ]);
      if (!used && !inHistory) {
        await this.prisma.movie.delete({ where: { id: item.movieId } });
      }
    }
    await this.touch(wheelId);
    return { ok: true };
  }

  async updateItemWeight(
    wheelId: string,
    itemId: string,
    userId: string,
    weight: number,
  ) {
    await this.assertWheelOwned(wheelId, userId);
    return this.prisma.wheelItem.update({
      where: { id: itemId },
      data: { weight: Math.max(0, weight) },
      include: { movie: true },
    });
  }

  /** Заповнює вагу кожної позиції балами IMDb відповідного фільму (fallback 1). */
  async weightsFromImdb(wheelId: string, userId: string) {
    await this.assertWheelOwned(wheelId, userId);
    const items = await this.prisma.wheelItem.findMany({
      where: { wheelId },
      include: { movie: true },
    });
    await this.prisma.$transaction(
      items.map((it) =>
        this.prisma.wheelItem.update({
          where: { id: it.id },
          data: { weight: it.movie.imdbRating ?? 1 },
        }),
      ),
    );
    return this.prisma.wheelItem.findMany({
      where: { wheelId },
      orderBy: ITEM_ORDER,
      include: { movie: true },
    });
  }

  private touch(wheelId: string) {
    return this.prisma.wheel.update({
      where: { id: wheelId },
      data: { updatedAt: new Date() },
    });
  }

  // ── Спін: зважений вибір переможця на бекенді ──

  async spin(wheelId: string, userId: string, itemIds?: string[]) {
    await this.assertWheelOwned(wheelId, userId);

    const all = await this.prisma.wheelItem.findMany({
      where: { wheelId },
      orderBy: ITEM_ORDER,
      include: { movie: true },
    });

    // Режим «на вибування» надсилає лише активні позиції; порожньо → усі.
    const active = new Set(itemIds ?? []);
    const items = itemIds?.length ? all.filter((i) => active.has(i.id)) : all;

    if (items.length < 2) {
      throw new BadRequestException('Потрібно щонайменше 2 позиції');
    }

    // Вага ≤ 0 → 0 (не випадає); якщо всі нульові — рівні шанси.
    const weights = items.map((i) => (i.weight > 0 ? i.weight : 0));
    let total = weights.reduce((s, w) => s + w, 0);
    const effective = total > 0 ? weights : items.map(() => 1);
    total = effective.reduce((s, w) => s + w, 0);

    let r = Math.random() * total;
    let index = effective.length - 1;
    for (let i = 0; i < effective.length; i++) {
      r -= effective[i];
      if (r <= 0) {
        index = i;
        break;
      }
    }

    const winner = items[index];
    const spin = await this.prisma.spinHistory.create({
      data: { wheelId, movieId: winner.movieId },
    });

    return {
      spinId: spin.id,
      index,
      winner: winner.movie,
      order: items.map((i) => i.id),
      createdAt: spin.createdAt,
    };
  }

  async history(wheelId: string, userId: string, limit = 20) {
    await this.assertWheelOwned(wheelId, userId);
    return this.prisma.spinHistory.findMany({
      where: { wheelId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        movie: { select: { id: true, title: true, posterUrl: true } },
      },
    });
  }

  async clearHistory(wheelId: string, userId: string) {
    await this.assertWheelOwned(wheelId, userId);
    await this.prisma.spinHistory.deleteMany({ where: { wheelId } });
    return { ok: true };
  }
}
