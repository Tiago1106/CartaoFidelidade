import { z } from 'zod';

// Only what the API needs today. Each milestone adds its own variables (billing, e-mail).
// Secrets have no default on purpose: a missing one must stop the server, not run with a guess.
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_URL: z.string().url().default('http://localhost:5173'),
    API_URL: z.string().url().default('http://localhost:3000'),
    // Database. `DATABASE_URL` is the `app_user` role (subject to RLS), `DATABASE_URL_SYSTEM` is
    // `app_system` (ignores RLS) and `DATABASE_URL_MIGRATE` is the owner that runs migrations.
    // The passwords of the two roles are taken from these URLs by `pnpm db:migrate`.
    DATABASE_URL: z.string().url().optional(),
    DATABASE_URL_SYSTEM: z.string().url().optional(),
    DATABASE_URL_MIGRATE: z.string().url().optional(),
    // How the code of the customer is sent. Only `console` exists for now: it prints the code in
    // the terminal of the API and runs only in development (decision D-022).
    SMS_PROVIDER: z.enum(['console']).optional(),
    // Key of the hash of the SMS codes. In development a fixed one is used when it is missing.
    OTP_HASH_SECRET: z.string().min(16).optional(),
    // Key that signs the access tokens (32 characters or more). In development a fixed one is used
    // when it is missing.
    JWT_SECRET: z.string().min(32).optional(),
    // How many proxies sit in front of the API. The limit per IP (RN-AUT-03) needs the real
    // address of the caller; with 0 the address of the connection itself is used.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;
    // A deployed API never prints codes and never runs with a made up secret.
    if (env.SMS_PROVIDER === 'console') {
      context.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'console is for development only',
      });
    }
    if (!env.JWT_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'is required in production',
      });
    }
    if (!env.OTP_HASH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['OTP_HASH_SECRET'],
        message: 'is required in production',
      });
    }
  });

export type Env = z.infer<typeof schema>;

/** Reads and checks the environment. Throws a message that names every wrong variable. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // `NAME=` in a `.env` file means "not set yet", not a value of zero characters.
  const filled = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(filled);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  return result.data;
}
