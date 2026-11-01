import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CLOCK, type Clock } from '../clock/clock';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /** Tells that the API is up. The database check arrives with the database (T18). */
  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        time: { type: 'string', format: 'date-time', example: '2026-11-01T12:00:00.000Z' },
      },
      required: ['status', 'time'],
    },
  })
  check() {
    return { status: 'ok', time: this.clock.now().toISOString() };
  }
}
