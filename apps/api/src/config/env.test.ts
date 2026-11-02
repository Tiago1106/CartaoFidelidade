import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('uses the development defaults', () => {
    const env = loadEnv({});
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('reads the port as a number', () => {
    expect(loadEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('golden rule 8: production never prints codes and never runs without a hash secret', () => {
    const production = { NODE_ENV: 'production' };
    expect(() =>
      loadEnv({ ...production, SMS_PROVIDER: 'console', OTP_HASH_SECRET: 'x'.repeat(32) }),
    ).toThrow(/SMS_PROVIDER/);
    expect(() => loadEnv(production)).toThrow(/OTP_HASH_SECRET/);
    expect(loadEnv({ ...production, OTP_HASH_SECRET: 'x'.repeat(32) }).NODE_ENV).toBe('production');
  });

  it('a variable left empty, as in a fresh copy of .env.example, counts as not set', () => {
    const env = loadEnv({ OTP_HASH_SECRET: '', DATABASE_URL: '', PORT: '' });
    expect(env.OTP_HASH_SECRET).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PORT).toBe(3000);
  });

  it('reads how many proxies sit in front of the API', () => {
    expect(loadEnv({}).TRUST_PROXY_HOPS).toBe(0);
    expect(loadEnv({ TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
  });

  it('refuses a wrong value and names the variable', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => loadEnv({ APP_URL: 'not a url' })).toThrow(/APP_URL/);
  });
});
