import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { migrate } from '../db/migrate';
import {
  APP_SYSTEM_PASSWORD,
  APP_USER_PASSWORD,
  MIGRATIONS_DIR,
  TEMPLATE_DATABASE,
} from './constants';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Superuser connection of the container, to create a database per test file. */
    postgresUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/**
 * Starts one Postgres 16 for the whole run of the integration tests and prepares a template
 * database with every migration applied. The roles belong to the whole server, so the
 * migrations run once here and never in parallel from the test files.
 */
export async function setup(project: TestProject) {
  try {
    container = await new PostgreSqlContainer('postgres:16').start();
  } catch (error) {
    throw new Error(
      `Could not start Postgres for the integration tests. Is Docker running? (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
  const base = container.getConnectionUri();

  const server = new pg.Client({ connectionString: base });
  await server.connect();
  await server.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  await server.end();

  const templateUrl = new URL(base);
  templateUrl.pathname = `/${TEMPLATE_DATABASE}`;
  await migrate({
    url: templateUrl.toString(),
    dir: MIGRATIONS_DIR,
    rolePasswords: { appUser: APP_USER_PASSWORD, appSystem: APP_SYSTEM_PASSWORD },
  });

  project.provide('postgresUrl', base);
}

export async function teardown() {
  await container?.stop();
}
