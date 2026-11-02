import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { ManualClock } from '../clock/clock';
import { loadEnv } from '../config/env';
import { createDatabase } from '../db/database';
import { createLogger } from '../logging/logger';
import { createTestDatabase, type TestDatabase } from '../test/test-database';

const env = loadEnv({ NODE_ENV: 'test' });

describe('GET /health with a database', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(() => t.close());

  it('reports the database as ok', async () => {
    const app = await createApp({
      env,
      db: t.db,
      clock: new ManualClock(),
      logger: createLogger({ level: 'silent' }),
    });
    await app.init();
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'ok' });
    await app.close();
  });

  it('answers 503 when the database does not', async () => {
    const broken = createDatabase('postgres://app_user:wrong@127.0.0.1:1/none');
    const app = await createApp({
      env,
      db: broken,
      clock: new ManualClock(),
      logger: createLogger({ level: 'silent' }),
    });
    await app.init();
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
    await app.close();
    await broken.destroy();
  });
});
