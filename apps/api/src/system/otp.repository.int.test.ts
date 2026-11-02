import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { OtpRepository } from './otp.repository';

// The locks of `exclusive()`. The work below reads, waits and only then writes, which is the
// worst case for a limit: without a lock, every request reads the count before any of them
// writes, and all of them pass.

let t: TestDatabase;
let repository: OtpRepository;

beforeAll(async () => {
  t = await createTestDatabase();
  repository = new OtpRepository(t.system);
});
afterAll(() => t.close());

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const since = new Date('2000-01-01T00:00:00Z');
const at = new Date('2026-11-01T12:00:00Z');

/** Asks for a code the way the service does, but slowly, under a limit of `limit`. */
async function slowRequest(
  phone: string,
  ip: string | null,
  limit: { phone?: number; ip?: number },
) {
  return repository.exclusive(phone, ip, async (db) => {
    const byPhone = await db.recentByPhone(phone, since, limit.phone ?? 1000);
    const byIp = ip ? await db.recentByIp(ip, since, limit.ip ?? 1000) : [];
    await wait(40);
    if (limit.phone !== undefined && byPhone.length >= limit.phone) return false;
    if (limit.ip !== undefined && byIp.length >= limit.ip) return false;
    await db.insertCode({ phone, codeHash: 'h', ip, createdAt: at, expiresAt: at });
    return true;
  });
}

describe('OtpRepository.exclusive', () => {
  it('holds back requests for the same number, even from different addresses', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        slowRequest('+5511911110000', `10.0.0.${i + 1}`, { phone: 3 }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it('holds back requests from the same address, even for different numbers', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        slowRequest(`+551192222${String(1000 + i)}`, '10.9.9.9', { ip: 4 }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
  });

  it('does not make unrelated requests wait for each other', async () => {
    const started = Date.now();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        slowRequest(`+551193333${String(1000 + i)}`, `10.1.0.${i + 1}`, {}),
      ),
    );
    // Eight requests of 40 ms each, in parallel: far less than the 320 ms of a queue.
    expect(Date.now() - started).toBeLessThan(250);
  });

  it('releases the locks when the work fails', async () => {
    await expect(
      repository.exclusive('+5511944440000', '10.5.5.5', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(
      repository.exclusive('+5511944440000', '10.5.5.5', async () => 'free'),
    ).resolves.toBe('free');
  });

  it('writes nothing when the work fails', async () => {
    await expect(
      repository.exclusive('+5511955550000', null, async (db) => {
        await db.insertCode({
          phone: '+5511955550000',
          codeHash: 'h',
          ip: null,
          createdAt: at,
          expiresAt: at,
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow();
    const { rows } = await t.admin.query(
      "SELECT 1 FROM otp_codes WHERE phone_e164 = '+5511955550000'",
    );
    expect(rows).toHaveLength(0);
  });
});
