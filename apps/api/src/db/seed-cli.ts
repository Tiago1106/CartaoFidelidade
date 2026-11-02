import pg from 'pg';
import { loadEnv } from '../config/env';
import { seed, SEED_CUSTOMER } from './seed';

const env = loadEnv();
if (env.NODE_ENV === 'production') {
  console.error('The sample data is never loaded in production.');
  process.exit(1);
}
if (!env.DATABASE_URL_MIGRATE) {
  console.error('DATABASE_URL_MIGRATE is not set. Copy .env.example to .env.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: env.DATABASE_URL_MIGRATE });
await client.connect();
try {
  await seed(client);
  console.log(`Sample data loaded. Sign in with ${SEED_CUSTOMER.phone} (${SEED_CUSTOMER.name}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
