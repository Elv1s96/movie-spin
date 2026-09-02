import { Body, Controller, Param, Post } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { SuggestDto } from './dto/suggestion.dto';

// Єдиний запис, доступний без JWT: гість пропонує фільм по токену публічного
// посилання. Навмисно окремий контролер без JwtAuthGuard — усе, що можна
// зробити цим маршрутом, обмежене активною сесією власника токена:
// поза сесією запит відхиляється, а фільм береться лише з його бібліотеки.
@Controller('public/suggestions')
export class PublicSuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Post(':token')
  suggest(@Param('token') token: string, @Body() dto: SuggestDto) {
    return this.suggestions.suggest(token, dto);
  }
}
