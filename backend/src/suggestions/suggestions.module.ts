import { Module } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';
import { PublicSuggestionsController } from './public-suggestions.controller';

@Module({
  controllers: [SuggestionsController, PublicSuggestionsController],
  providers: [SuggestionsService],
  // MoviesModule домішує стан пропонування у відповідь публічного посилання.
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
