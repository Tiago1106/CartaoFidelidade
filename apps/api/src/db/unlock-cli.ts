import pg from 'pg';
import { loadEnv } from '../config/env';

// Development only. The limits of the SMS code (3 per hour per number, 20 per hour per address,
// 15 minutes of lock) are real rules (RN-AUT-02, RN-AUT-03), so testing the sign-in over and over
// reaches them. This clears the codes and the locks so a test can start again. The rules in the
// code are not changed.
const env = loadEnv();
if (env.NODE_ENV === 'production') {
  console.error('This is for development only.');
  process.exit(1);
}
if (!env.DATABASE_URL_MIGRATE) {
  console.error('DATABASE_URL_MIGRATE is not set. Copy .env.example to .env.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: env.DATABASE_URL_MIGRATE });
await client.connect();
try {
  const codes = await client.query('DELETE FROM otp_codes');
  const locks = await client.query('DELETE FROM phone_lockouts');
  console.log(`Cleared ${codes.rowCount} codes and ${locks.rowCount} locks.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
