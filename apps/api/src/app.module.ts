import { Module, type DynamicModule, type OnModuleDestroy, type Type } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from './clock/clock';
import { DATABASE, type Database } from './db/database';
import { HealthController } from './health/health.controller';

/** Closes the pool of a database the app opened itself. */
@Injectable()
class DatabaseShutdown implements OnModuleDestroy {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onModuleDestroy() {
    await this.db.destroy();
  }
}

@Module({})
export class AppModule {
  /** What the app needs from outside is passed in, so tests can swap the clock or the database. */
  static register(deps: {
    clock: Clock;
    /** Connection of role `app_user`. The app runs without a database when it is left out. */
    db?: Database;
    /** True when the app opened `db` itself and has to close it. */
    ownsDatabase?: boolean;
    extraControllers?: Type[];
  }): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ...(deps.extraControllers ?? [])],
      providers: [
        { provide: CLOCK, useValue: deps.clock },
        ...(deps.db ? [{ provide: DATABASE, useValue: deps.db }] : []),
        ...(deps.db && deps.ownsDatabase ? [DatabaseShutdown] : []),
      ],
    };
  }
}
