import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Logger } from 'pino';
import { errorMessages } from '../messages/pt-BR';
import { AppError, errorStatus, type ErrorCode, type ErrorDetails } from './app-error';

interface Body {
  error: { code: ErrorCode; message: string; details?: ErrorDetails; requestId: string };
}

/** Turns anything thrown into the error format of docs/API.md section 1. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const requestId = request.id ?? response.getHeader('X-Request-Id')?.toString() ?? '';

    const { status, body } = this.toBody(exception, requestId);

    if (status >= 500) {
      // The error object can hold personal data, so only its name and message are logged.
      const error = exception instanceof Error ? exception : undefined;
      this.logger.error({ requestId, errorName: error?.name, errorMessage: error?.message });
    }

    const retryAfter = body.error.details?.retryAfterSeconds;
    if ((status === 429 || status === 423) && typeof retryAfter === 'number') {
      response.setHeader('Retry-After', String(retryAfter));
    }
    response.status(status).json(body);
  }

  private toBody(exception: unknown, requestId: string): { status: number; body: Body } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details ? { details: exception.details } : {}),
            requestId,
          },
        },
      };
    }

    // Errors of the framework itself, such as a route that does not exist.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code: ErrorCode =
        status === 404
          ? 'NOT_FOUND'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 403
              ? 'FORBIDDEN_ROLE'
              : status === 429
                ? 'RATE_LIMITED'
                : status >= 500
                  ? 'INTERNAL_ERROR'
                  : 'VALIDATION_ERROR';
      return {
        status: errorStatus[code],
        body: { error: { code, message: errorMessages[code], requestId } },
      };
    }

    return {
      status: 500,
      body: {
        error: { code: 'INTERNAL_ERROR', message: errorMessages.INTERNAL_ERROR, requestId },
      },
    };
  }
}
