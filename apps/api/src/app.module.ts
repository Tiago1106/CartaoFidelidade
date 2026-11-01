import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { CLOCK, type Clock } from './clock/clock';
import { HealthController } from './health/health.controller';

@Module({})
export class AppModule {
  /** What the app needs from outside is passed in, so tests can swap the clock. */
  static register(deps: { clock: Clock; extraControllers?: Type[] }): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ...(deps.extraControllers ?? [])],
      providers: [{ provide: CLOCK, useValue: deps.clock }],
    };
  }
}
