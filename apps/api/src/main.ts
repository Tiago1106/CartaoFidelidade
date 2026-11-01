import { createApp } from './app';
import { loadEnv } from './config/env';
import { createLogger } from './logging/logger';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL ?? 'info' });
const app = await createApp({ env, logger });
await app.listen(env.PORT);
logger.info({ port: env.PORT }, 'API listening');
