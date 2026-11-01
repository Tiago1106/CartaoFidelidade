import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';

/**
 * One line per request: method, path, status and time. The path has no query string, because a
 * query can carry a phone number or a token.
 */
export function requestLogger(logger: Logger) {
  return (request: Request & { id?: string }, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info({
        requestId: request.id,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        status: response.statusCode,
        ms: Math.round(ms),
      });
    });
    next();
  };
}
