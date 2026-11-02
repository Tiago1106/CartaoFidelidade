import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { otpRequestSchema, type OtpRequest, type OtpRequestResponse } from '@fregues/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { OtpService } from './otp.service';

@ApiTags('customer auth')
@Controller('customer/auth')
export class CustomerAuthController {
  constructor(@Inject(OtpService) private readonly otp: OtpService) {}

  @Post('otp/request')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Sends the code of 6 digits by SMS',
    description:
      'The answer is the same whether or not the number has an account (RN-AUT-05). ' +
      'The code is valid for 5 minutes and replaces the previous one. Limits: 3 per hour per number and per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { phone: { type: 'string', example: '+5511912345678' } },
      required: ['phone'],
    },
  })
  @ApiAcceptedResponse({
    schema: { type: 'object', properties: { retryAfterSeconds: { type: 'integer', example: 60 } } },
  })
  @ApiResponse({ status: 422, description: 'PHONE_NOT_SUPPORTED or VALIDATION_ERROR' })
  @ApiResponse({ status: 423, description: 'OTP_LOCKED. `details.retryAfterSeconds`.' })
  @ApiResponse({ status: 429, description: 'RATE_LIMITED. `Retry-After` header.' })
  request(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequest,
    @Req() request: Request,
  ): Promise<OtpRequestResponse> {
    return this.otp.request(body.phone, request.ip ?? null);
  }
}
