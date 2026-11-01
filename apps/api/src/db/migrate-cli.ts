import { resolve } from 'node:path';
import { loadEnv } from '../config/env';
import { migrate } from './migrate';

const env = loadEnv();
if (!env.DATABASE_URL_MIGRATE) {
  console.error('DATABASE_URL_MIGRATE is not set. Copy .env.example to .env.');
  process.exit(1);
}

/** The password of a role is the one written in its own connection URL. */
const passwordOf = (url?: string) => (url ? decodeURIComponent(new URL(url).password) : undefined);

try {
  const { applied, skipped } = await migrate({
    url: env.DATABASE_URL_MIGRATE,
    dir: resolve(process.cwd(), 'migrations'),
    rolePasswords: {
      appUser: passwordOf(env.DATABASE_URL),
      appSystem: passwordOf(env.DATABASE_URL_SYSTEM),
    },
    log: (message) => console.log(message),
  });
  console.log(`Migrations: ${applied.length} applied, ${skipped.length} already up to date.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
