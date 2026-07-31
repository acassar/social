import 'reflect-metadata';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import type { EnvironmentVariables } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  // Sert les fichiers uploadés (M5-T1) sous /uploads. En prod, le reverse
  // proxy sert ce même dossier directement (cf. doc/BACKLOG.md M7-T2) ;
  // c'est utile en dev/local pour vérifier une URL renvoyée par POST /uploads.
  const uploadsDir = resolve(process.cwd(), configService.get('UPLOADS_DIR', { infer: true }));
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap();
