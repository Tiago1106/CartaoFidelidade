import {
  createParamDecorator,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../errors/app-error';
import { AccessTokenService } from './access-token.service';

type CustomerRequest = Request & { customerId?: string };

const BEARER = /^Bearer ([^\s]+)$/i;

/**
 * Lets in only a request with a valid access token of a customer (docs/API.md section 1).
 * An expired token is `TOKEN_EXPIRED`, so the app tries the refresh; any other bad token is
 * `UNAUTHENTICATED`. The id of the customer comes from the signed token and is read in the
 * handlers with `@CurrentCustomerId()`, never from the body or the URL.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(@Inject(AccessTokenService) private readonly tokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new AppError('UNAUTHENTICATED');
    request.customerId = (await this.tokens.verify(token)).sub;
    return true;
  }
}

/** The id of the customer that the guard took from the access token. */
export const CurrentCustomerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const id = context.switchToHttp().getRequest<CustomerRequest>().customerId;
    if (!id) throw new AppError('UNAUTHENTICATED');
    return id;
  },
);
