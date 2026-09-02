import { Controller, Get, Param } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { SuggestionsService } from '../suggestions/suggestions.service';

// Читання чужої бібліотеки по токену публічного посилання — без JWT.
// Навмисно окремий контролер без JwtAuthGuard — у MoviesController гард висить
// на класі, тож там нічого не «протече». Тільки читання: створення/зміна/
// видалення сюди не додаються (пропозиції гостя — у PublicSuggestionsController).
@Controller('public/movies')
export class PublicMoviesController {
  constructor(
    private readonly movies: MoviesService,
    private readonly suggestions: SuggestionsService,
  ) {}

  // Разом зі списком віддаємо стан пропонування: suggest = null, якщо сесія
  // не запущена або вже закрита — тоді сторінка гостя лише для перегляду.
  @Get(':token')
  async findByShareToken(@Param('token') token: string) {
    const { ownerId, movies } = await this.movies.findAllByShareToken(token);
    const suggest = await this.suggestions.publicState(ownerId);
    return { movies, suggest };
  }
}
