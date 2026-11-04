import { Controller, Header, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { QrToken } from '@fregues/shared';
import { CurrentCustomerId, CustomerAuthGuard } from '../customer-auth/customer-auth.guard';
import { QrTokenService } from './qr-token.service';

@ApiTags('customer')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('customer')
export class CustomerQrController {
  constructor(@Inject(QrTokenService) private readonly qr: QrTokenService) {}

  @Post('qr-token')
  @HttpCode(200)
  // The answer is a one use secret: no cache, shared or private, may keep it.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Issues the token of the QR (My QR)',
    description:
      'Valid for 45 seconds and for one scan. The app draws `qrPayload` and asks again every ' +
      '`renewInSeconds` while in the foreground (RN-QR-02, RN-QR-04). A new token replaces the ' +
      'previous ones. Limit: 6 per minute per customer.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        qrPayload: { type: 'string', example: 'lc1.eyJhbGciOi…' },
        expiresAt: { type: 'string', format: 'date-time' },
        renewInSeconds: { type: 'integer', example: 30 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED or TOKEN_EXPIRED' })
  @ApiResponse({ status: 429, description: 'RATE_LIMITED. `Retry-After` header.' })
  issue(@CurrentCustomerId() customerId: string): Promise<QrToken> {
    return this.qr.issue(customerId);
  }
}
