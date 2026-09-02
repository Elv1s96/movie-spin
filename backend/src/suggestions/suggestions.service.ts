import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartSessionDto, SuggestDto } from './dto/suggestion.dto';
import { normalizeOptions, SessionOptions } from './session-options';

// Те, що бачить власник про свою активну сесію.
export interface SessionInfo {
  id: string;
  wheelId: string;
  wheelName: string;
  options: SessionOptions;
  /** Скільки фільмів уже запропонували гості. */
  count: number;
  createdAt: Date;
}

// Блок пропонування у відповіді публічного посилання. null → сесії немає,
// і сторінка працює як раніше: просто перегляд списку.
export interface PublicSuggestState {
  wheelName: string;
  options: SessionOptions;
  suggested: { movieId: string; guestName: string | null }[];
}

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Бік власника ──────────────────────────────────────────────────────────

  /** Активна сесія користувача (closedAt = null) або null. */
  async getActive(userId: string): Promise<SessionInfo | null> {
    const session = await this.prisma.suggestionSession.findFirst({
      where: { userId, closedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        wheel: { select: { name: true } },
        _count: { select: { suggestions: true } },
      },
    });
    if (!session) return null;
    return {
      id: session.id,
      wheelId: session.wheelId,
      wheelName: session.wheel.name,
      options: normalizeOptions(session.options),
      count: session._count.suggestions,
      createdAt: session.createdAt,
    };
  }

  /**
   * Запускає сесію: колесо або вибирається зі своїх (wheelId), або створюється
   * за назвою (wheelName). Попередня активна сесія при цьому закривається —
   * активна завжди одна, інакше незрозуміло, в яке колесо йдуть пропозиції.
   */
  async start(userId: string, dto: StartSessionDto): Promise<SessionInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shareToken: true },
    });
    // Без публічного посилання пропонувати нікому: гість просто не зайде.
    if (!user?.shareToken) {
      throw new BadRequestException('Спочатку створи публічне посилання');
    }

    let wheelId = dto.wheelId;
    if (wheelId) {
      const wheel = await this.prisma.wheel.findUnique({ where: { id: wheelId } });
      if (!wheel) throw new NotFoundException('Колесо не знайдено');
      if (wheel.userId !== userId) throw new ForbiddenException();
    } else if (dto.wheelName?.trim()) {
      const wheel = await this.prisma.wheel.create({
        data: { userId, name: dto.wheelName.trim() },
      });
      wheelId = wheel.id;
    } else {
      throw new BadRequestException('Обери колесо або вкажи назву нового');
    }

    await this.closeAll(userId);

    const session = await this.prisma.suggestionSession.create({
      data: {
        userId,
        wheelId,
        options: { ...normalizeOptions(dto.options) },
      },
      include: {
        wheel: { select: { name: true } },
        _count: { select: { suggestions: true } },
      },
    });

    return {
      id: session.id,
      wheelId: session.wheelId,
      wheelName: session.wheel.name,
      options: normalizeOptions(session.options),
      count: session._count.suggestions,
      createdAt: session.createdAt,
    };
  }

  /** Закриває пропонування: набране колесо лишається, кнопки в гостя зникають. */
  async close(userId: string) {
    await this.closeAll(userId);
    return { ok: true };
  }

  private closeAll(userId: string) {
    return this.prisma.suggestionSession.updateMany({
      where: { userId, closedAt: null },
      data: { closedAt: new Date() },
    });
  }

  // ── Бік гостя (по токену публічного посилання) ────────────────────────────

  /**
   * Стан пропонування для сторінки гостя. Приймає id власника, якого
   * публічний контролер уже знайшов по токену.
   */
  async publicState(ownerId: string): Promise<PublicSuggestState | null> {
    const session = await this.prisma.suggestionSession.findFirst({
      where: { userId: ownerId, closedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        wheel: { select: { name: true } },
        suggestions: {
          orderBy: { createdAt: 'asc' },
          select: { movieId: true, guestName: true },
        },
      },
    });
    if (!session) return null;
    return {
      wheelName: session.wheel.name,
      options: normalizeOptions(session.options),
      suggested: session.suggestions,
    };
  }

  /**
   * Пропозиція від гостя: створює запис Suggestion і одразу кладе фільм у
   * колесо сесії. Ідемпотентно — якщо фільм уже запропонували (наприклад,
   * двоє натиснули одночасно), просто повертаємо наявний запис.
   */
  async suggest(token: string, dto: SuggestDto) {
    if (!token) throw new NotFoundException('Посилання недійсне');
    const owner = await this.prisma.user.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });
    if (!owner) throw new NotFoundException('Посилання недійсне або відкликане');

    const session = await this.prisma.suggestionSession.findFirst({
      where: { userId: owner.id, closedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw new BadRequestException('Пропонування вже закрите');

    const options = normalizeOptions(session.options);
    const guestName = options.askName ? dto.guestName?.trim() || null : null;
    if (options.requireName && !guestName) {
      throw new BadRequestException('Вкажи своє ім’я');
    }

    // Пропонувати можна лише фільми з бібліотеки власника — своїх слів гість
    // не додає, тож isCustom-записи сюди не пускаємо.
    const movie = await this.prisma.movie.findUnique({
      where: { id: dto.movieId },
      select: { id: true, userId: true, isCustom: true },
    });
    if (!movie || movie.userId !== owner.id || movie.isCustom) {
      throw new NotFoundException('Фільм не знайдено');
    }

    const existing = await this.prisma.suggestion.findUnique({
      where: { sessionId_movieId: { sessionId: session.id, movieId: movie.id } },
      select: { movieId: true, guestName: true },
    });
    if (existing) return existing;

    const [suggestion] = await this.prisma.$transaction([
      this.prisma.suggestion.create({
        data: { sessionId: session.id, movieId: movie.id, guestName },
        select: { movieId: true, guestName: true },
      }),
      this.prisma.wheelItem.upsert({
        where: { wheelId_movieId: { wheelId: session.wheelId, movieId: movie.id } },
        create: { wheelId: session.wheelId, movieId: movie.id },
        update: {},
      }),
      this.prisma.wheel.update({
        where: { id: session.wheelId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return suggestion;
  }
}
