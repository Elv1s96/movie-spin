import { Module } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { PublicMoviesController } from './public-movies.controller';

@Module({
  controllers: [MoviesController, PublicMoviesController],
  providers: [MoviesService],
})
export class MoviesModule {}
