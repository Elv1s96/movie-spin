import { Module } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { PublicMoviesController } from './public-movies.controller';
import { SuggestionsModule } from '../suggestions/suggestions.module';

@Module({
  // Публічна відповідь містить ще й стан пропонування — див. PublicMoviesController.
  imports: [SuggestionsModule],
  controllers: [MoviesController, PublicMoviesController],
  providers: [MoviesService],
})
export class MoviesModule {}
