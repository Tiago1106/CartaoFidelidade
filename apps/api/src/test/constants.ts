import { resolve } from 'node:path';

export const MIGRATIONS_DIR = resolve(__dirname, '../../migrations');

/** Database with every migration applied. Each test file copies it (`CREATE DATABASE ... TEMPLATE`). */
export const TEMPLATE_DATABASE = 'template_fregues';

export const APP_USER_PASSWORD = 'app_user_test_password';
export const APP_SYSTEM_PASSWORD = 'app_system_test_password';
