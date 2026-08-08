import { Module } from '@nestjs/common';
import { WheelsService } from './wheels.service';
import { WheelsController } from './wheels.controller';

@Module({
  controllers: [WheelsController],
  providers: [WheelsService],
})
export class WheelsModule {}
