import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error';

/**
 * Validates a body, query or param with a Zod schema, for example
 * `@Body(new ZodValidationPipe(schema))`. A wrong value becomes `VALIDATION_ERROR` with the list
 * of fields in `details.fields` (docs/API.md section 2). The value itself is never echoed back.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const fields = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      reason: issue.code,
    }));
    throw new AppError('VALIDATION_ERROR', { details: { fields } });
  }
}
