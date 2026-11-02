import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Logger } from 'pino';
import { AppModule, type CustomerAuthDeps } from './app.module';
import { systemClock, type Clock } from './clock/clock';
import { loadEnv, type Env } from './config/env';
import { createOtpSender } from './customer-auth/otp-sender.factory';
import type { OtpSender } from './customer-auth/otp-sender';
import type { OtpConfig } from './customer-auth/otp.service';
import { createDatabase, type Database } from './db/database';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { requestId } from './http/request-id.middleware';
import { createLogger } from './logging/logger';
import { requestLogger } from './logging/request-logger.middleware';
// The one place outside `src/system/` that opens the connection of `app_system`: the composition
// root hands it to the system module and to nobody else.
import { createSystemDatabase, type SystemDatabase } from './system/system-database';

/** Used when `OTP_HASH_SECRET` is not set, in development and in tests only. */
const DEVELOPMENT_OTP_HASH_SECRET = 'development-only-otp-hash-secret';
/** Used when `JWT_SECRET` is not set, in development and in tests only. */
const DEVELOPMENT_JWT_SECRET = 'development-only-jwt-secret-of-32-chars-or-more';

export interface AppOptions {
  env?: Env;
  clock?: Clock;
  logger?: Logger;
  /** A database to use instead of the one in `DATABASE_URL`. The caller closes it. */
  db?: Database;
  /** The connection of `app_system` to use instead of `DATABASE_URL_SYSTEM`. The caller closes it. */
  systemDb?: SystemDatabase;
  /** How codes are sent, instead of the provider of `SMS_PROVIDER`. */
  otpSender?: OtpSender;
  /** Settings of the SMS code, instead of the ones of the environment. */
  otp?: Partial<OtpConfig>;
  /** Key of the access tokens, instead of `JWT_SECRET`. */
  jwtSecret?: string;
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

  // Without a database passed in, the app opens the ones in the environment, when they are set,
  // and then it closes them too.
  const ownedDatabases: Database[] = [];
  let db = options.db;
  if (!db && env.DATABASE_URL) {
    db = createDatabase(env.DATABASE_URL);
    ownedDatabases.push(db);
  }
  let systemDb = options.systemDb;
  if (!systemDb && env.DATABASE_URL_SYSTEM) {
    systemDb = createSystemDatabase(env.DATABASE_URL_SYSTEM);
    ownedDatabases.push(systemDb);
  }

  // The sign-in of the customer needs the connection of `app_system`.
  let customerAuth: CustomerAuthDeps | undefined;
  if (systemDb) {
    const hashSecret =
      options.otp?.hashSecret ??
      env.OTP_HASH_SECRET ??
      (env.NODE_ENV === 'production' ? undefined : DEVELOPMENT_OTP_HASH_SECRET);
    if (!hashSecret) throw new Error('OTP_HASH_SECRET is not set.');
    const accessTokenSecret =
      options.jwtSecret ??
      env.JWT_SECRET ??
      (env.NODE_ENV === 'production' ? undefined : DEVELOPMENT_JWT_SECRET);
    if (!accessTokenSecret) throw new Error('JWT_SECRET is not set.');
    customerAuth = {
      systemDb,
      sender: options.otpSender ?? createOtpSender(env),
      otp: { ...options.otp, hashSecret },
      accessTokenSecret,
      // The browser only keeps a `Secure` cookie from an https address (localhost aside).
      cookieSecure: env.API_URL.startsWith('https:'),
    };
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register({
      clock,
      db,
      customerAuth,
      ownedDatabases,
      extraControllers: options.extraControllers,
    }),
    { logger: false },
  );

  // The limit per IP (RN-AUT-03) needs the address of the caller, not the one of a proxy.
  if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);

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
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  return app;
}
