import { Controller, Get, Param } from '@nestjs/common';
import { MoviesService } from './movies.service';

// Єдиний маршрут, доступний без JWT: читання чужої бібліотеки по токену
// публічного посилання. Навмисно окремий контролер без JwtAuthGuard —
// у MoviesController гард висить на класі, тож там нічого не «протече».
// Тільки читання: створення/зміна/видалення сюди не додаються.
@Controller('public/movies')
export class PublicMoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get(':token')
  findByShareToken(@Param('token') token: string) {
    return this.movies.findAllByShareToken(token);
  }
}
