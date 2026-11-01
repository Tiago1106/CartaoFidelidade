import { Controller, Get, Inject, Optional, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sql } from 'kysely';
import { CLOCK, type Clock } from '../clock/clock';
import { DATABASE, type Database } from '../db/database';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Optional() @Inject(DATABASE) private readonly db?: Database,
  ) {}

  /** Tells that the API is up and, when it has a database, that the database answers. */
  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        time: { type: 'string', format: 'date-time', example: '2026-11-01T12:00:00.000Z' },
        database: { type: 'string', enum: ['ok', 'down'] },
      },
      required: ['status', 'time'],
    },
  })
  @ApiServiceUnavailableResponse({ description: 'The database does not answer.' })
  async check(@Res({ passthrough: true }) response: Response) {
    const time = this.clock.now().toISOString();
    if (!this.db) return { status: 'ok', time };

    try {
      await sql`SELECT 1`.execute(this.db);
      return { status: 'ok', time, database: 'ok' };
    } catch {
      response.status(503);
      return { status: 'degraded', time, database: 'down' };
    }
  }
}
