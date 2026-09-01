import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WheelsService } from './wheels.service';
import {
  AddItemDto,
  CreateWheelDto,
  SpinDto,
  UpdateItemWeightDto,
  UpdateWheelDto,
} from './dto/wheel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('wheels')
export class WheelsController {
  constructor(private readonly wheels: WheelsService) {}

  // movieId (необов'язковий) — щоб у відповіді був прапорець hasMovie.
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('movieId') movieId?: string) {
    return this.wheels.findAll(user.id, movieId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWheelDto) {
    return this.wheels.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wheels.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateWheelDto,
  ) {
    return this.wheels.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wheels.remove(id, user.id);
  }

  // Позиції колеса
  @Post(':id/items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddItemDto,
  ) {
    return this.wheels.addItem(id, user.id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemWeightDto,
  ) {
    return this.wheels.updateItemWeight(id, itemId, user.id, dto.weight);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.wheels.removeItem(id, itemId, user.id);
  }

  @Post(':id/items/weights-from-imdb')
  weightsFromImdb(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wheels.weightsFromImdb(id, user.id);
  }

  // Спін
  @Post(':id/spin')
  spin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SpinDto,
  ) {
    return this.wheels.spin(id, user.id, dto.itemIds);
  }

  @Get(':id/history')
  history(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.wheels.history(id, user.id, limit ? Number(limit) : 20);
  }

  @Delete(':id/history')
  clearHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wheels.clearHistory(id, user.id);
  }
}
