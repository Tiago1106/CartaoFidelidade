import { z } from 'zod';

// Only what the API needs today. Each milestone adds its own variables (database, SMS, billing).
// Secrets have no default on purpose: a missing one must stop the server, not run with a guess.
const schema = z.object({
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
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export type Env = z.infer<typeof schema>;

/** Reads and checks the environment. Throws a message that names every wrong variable. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  return result.data;
}
