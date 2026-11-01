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

  it('refuses a wrong value and names the variable', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => loadEnv({ APP_URL: 'not a url' })).toThrow(/APP_URL/);
  });
});
