import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WheelsModule } from './wheels/wheels.module';
import { MoviesModule } from './movies/movies.module';
import { GenresModule } from './genres/genres.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Роздаємо завантажені постери за адресою /uploads/<файл>.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    WheelsModule,
    MoviesModule,
    GenresModule,
  ],
})
export class AppModule {}
