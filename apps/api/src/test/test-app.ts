import { Body, Controller, Get, Param, Post, type Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { createApp } from '../app';
import { ManualClock } from '../clock/clock';
import { AppError, type ErrorCode } from '../errors/app-error';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { createLogger } from '../logging/logger';

const bodySchema = z.object({ name: z.string().min(1), age: z.number().int() });

/** Routes that exist only in tests, to make the app throw on purpose. */
@Controller('test')
class ThrowingController {
  @Get('error/:code')
  fail(@Param('code') code: ErrorCode) {
    throw new AppError(code);
  }

  @Get('limited')
  limited() {
    throw new AppError('RATE_LIMITED', { details: { retryAfterSeconds: 42 } });
  }

  @Get('custom-message')
  customMessage() {
    throw new AppError('STAMP_TOO_SOON', {
      message: 'A próxima visita só pode ser registrada às 15:40.',
      details: { nextAllowedAt: '2026-10-26T18:40:00Z' },
    });
  }

  @Get('crash')
  crash() {
    throw new Error('database password is hunter2');
  }

  @Post('validate')
  validate(@Body(new ZodValidationPipe(bodySchema)) body: z.infer<typeof bodySchema>) {
    return body;
  }
}

export interface TestApp {
  app: NestExpressApplication;
  clock: ManualClock;
  /** Every line the logger wrote. */
  logLines: string[];
}

export async function createTestApp(extra: Type[] = []): Promise<TestApp> {
  const clock = new ManualClock('2026-11-01T12:00:00Z');
  const logLines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      logLines.push(String(chunk));
      callback();
    },
  });
  const app = await createApp({
    env: {
      NODE_ENV: 'test',
      PORT: 3000,
      APP_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:3000',
    },
    clock,
    logger: createLogger({ destination }),
    extraControllers: [ThrowingController, ...extra],
  });
  await app.init();
  return { app, clock, logLines };
}
