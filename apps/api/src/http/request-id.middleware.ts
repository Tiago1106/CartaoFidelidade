import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Gives every request an id, returned in `X-Request-Id` and repeated in the error body. */
export function requestId(
  request: Request & { id?: string },
  response: Response,
  next: NextFunction,
) {
  // [Premissa] An id sent by a caller is not trusted: it could carry anything into the logs.
  request.id = randomUUID();
  response.setHeader('X-Request-Id', request.id);
  next();
}
