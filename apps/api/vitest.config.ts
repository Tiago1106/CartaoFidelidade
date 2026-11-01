import { defineConfig } from 'vitest/config';

// Two kinds of test:
// - unit (`*.test.ts`): no database, run anywhere.
// - integration (`*.int.test.ts`): a real Postgres 16 in a container (Testcontainers), so Docker
//   must be running. Each test file gets its own fresh database, with every migration applied.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['src/test/global-setup.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
