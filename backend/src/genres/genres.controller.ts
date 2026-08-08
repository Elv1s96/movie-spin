import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GenresService } from './genres.service';
import { CreateGenreDto, RenameGenreDto } from './dto/genre.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('genres')
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.genres.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGenreDto) {
    return this.genres.create(user.id, dto.name);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RenameGenreDto,
  ) {
    return this.genres.rename(id, user.id, dto.name);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.genres.remove(id, user.id);
  }
}
