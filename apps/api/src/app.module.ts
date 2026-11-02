import {
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type OnModuleDestroy,
  type Type,
} from '@nestjs/common';
import { CLOCK, type Clock } from './clock/clock';
import { CustomerAuthController } from './customer-auth/customer-auth.controller';
import { OTP_CONFIG, OtpService, type OtpConfig } from './customer-auth/otp.service';
import { OTP_SENDER, type OtpSender } from './customer-auth/otp-sender';
import { DATABASE, type Database } from './db/database';
import { HealthController } from './health/health.controller';
import { OtpRepository } from './system/otp.repository';
import { SYSTEM_DATABASE, type SystemDatabase } from './system/system-database';

const OWNED_DATABASES = Symbol('OWNED_DATABASES');

/** Closes the pools of the databases the app opened itself. */
@Injectable()
class DatabaseShutdown implements OnModuleDestroy {
  constructor(@Inject(OWNED_DATABASES) private readonly databases: Database[]) {}

  async onModuleDestroy() {
    await Promise.all(this.databases.map((db) => db.destroy()));
  }
}

export interface CustomerAuthDeps {
  /** Connection of role `app_system`: the codes and sessions belong to the system module. */
  systemDb: SystemDatabase;
  sender: OtpSender;
  otp: OtpConfig;
}

@Module({})
export class AppModule {
  /** What the app needs from outside is passed in, so tests can swap the clock or the database. */
  static register(deps: {
    clock: Clock;
    /** Connection of role `app_user`. The app runs without a database when it is left out. */
    db?: Database;
    /** The sign-in of the customer. Left out when there is no `app_system` connection. */
    customerAuth?: CustomerAuthDeps;
    /** Databases that the app opened itself and has to close. */
    ownedDatabases?: Database[];
    extraControllers?: Type[];
  }): DynamicModule {
    const { customerAuth } = deps;
    return {
      module: AppModule,
      controllers: [
        HealthController,
        ...(customerAuth ? [CustomerAuthController] : []),
        ...(deps.extraControllers ?? []),
      ],
      providers: [
        { provide: CLOCK, useValue: deps.clock },
        ...(deps.db ? [{ provide: DATABASE, useValue: deps.db }] : []),
        ...(customerAuth
          ? [
              { provide: SYSTEM_DATABASE, useValue: customerAuth.systemDb },
              { provide: OTP_SENDER, useValue: customerAuth.sender },
              { provide: OTP_CONFIG, useValue: customerAuth.otp },
              OtpRepository,
              OtpService,
            ]
          : []),
        ...(deps.ownedDatabases?.length
          ? [{ provide: OWNED_DATABASES, useValue: deps.ownedDatabases }, DatabaseShutdown]
          : []),
      ],
    };
  }
}
