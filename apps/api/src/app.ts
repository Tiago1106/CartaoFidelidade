import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Logger } from 'pino';
import { AppModule } from './app.module';
import { systemClock, type Clock } from './clock/clock';
import { loadEnv, type Env } from './config/env';
import { createDatabase, type Database } from './db/database';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { requestId } from './http/request-id.middleware';
import { createLogger } from './logging/logger';
import { requestLogger } from './logging/request-logger.middleware';

export interface AppOptions {
  env?: Env;
  clock?: Clock;
  logger?: Logger;
  /** A database to use instead of the one in `DATABASE_URL`. The caller closes it. */
  db?: Database;
  /** Controllers added next to the real ones. For tests only. */
  extraControllers?: Type[];
}

/** Builds the app without listening, so tests can call it with `supertest`. */
export async function createApp(options: AppOptions = {}): Promise<NestExpressApplication> {
  const env = options.env ?? loadEnv();
  const clock = options.clock ?? systemClock;
  const logger =
    options.logger ??
    createLogger({ level: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info') });

  // Without a database passed in, the app opens the one in `DATABASE_URL`, when it is set.
  const ownsDatabase = !options.db && Boolean(env.DATABASE_URL);
  const db = options.db ?? (env.DATABASE_URL ? createDatabase(env.DATABASE_URL) : undefined);

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register({ clock, db, ownsDatabase, extraControllers: options.extraControllers }),
    { logger: false },
  );

  // The API lives under /v1 (docs/API.md section 1). Health stays outside, for the platform.
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(requestLogger(logger));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Freguês API')
      .setDescription('REST contract v1. See docs/API.md.')
      .setVersion('1')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  return app;
}
