import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { StartSessionDto } from './dto/suggestion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

// Керування сесією пропонування — бік власника списку.
@UseGuards(JwtAuthGuard)
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  /** Активна сесія або null. */
  @Get('active')
  getActive(@CurrentUser() user: AuthUser) {
    return this.suggestions.getActive(user.id);
  }

  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSessionDto) {
    return this.suggestions.start(user.id, dto);
  }

  /** Закриває пропонування. Колесо з набраними фільмами лишається. */
  @Delete('active')
  close(@CurrentUser() user: AuthUser) {
    return this.suggestions.close(user.id);
  }
}
