import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  otpRequestSchema,
  otpVerifySchema,
  type AuthSessionResponse,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
} from '@fregues/shared';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { CustomerSessionService } from './customer-session.service';
import { OtpService } from './otp.service';
import { REFRESH_TTL_SECONDS } from './session-policy';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

export const COOKIE_SECURE = Symbol('COOKIE_SECURE');

const sessionResponse = {
  schema: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      expiresIn: { type: 'integer', example: 900 },
      customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          phone: { type: 'string', example: '+5511912345678' },
          name: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          profileComplete: { type: 'boolean' },
        },
      },
    },
  },
} as const;

@ApiTags('customer auth')
@Controller('customer/auth')
export class CustomerAuthController {
  constructor(
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(CustomerSessionService) private readonly session: CustomerSessionService,
    @Inject(COOKIE_SECURE) private readonly secure: boolean,
  ) {}

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

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirms the code and opens the session',
    description:
      'Creates the account when the number is new (`profileComplete` is then false). ' +
      'The refresh token is set in an HttpOnly cookie. 5 wrong attempts kill the code and lock the number for 15 minutes.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '+5511912345678' },
        code: { type: 'string', example: '123456' },
      },
      required: ['phone', 'code'],
    },
  })
  @ApiResponse({ status: 200, ...sessionResponse })
  @ApiResponse({ status: 400, description: 'OTP_INVALID (`details.attemptsLeft`) or OTP_EXPIRED' })
  @ApiResponse({ status: 422, description: 'PHONE_NOT_SUPPORTED or VALIDATION_ERROR' })
  @ApiResponse({ status: 423, description: 'OTP_LOCKED. `details.retryAfterSeconds`.' })
  async verify(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerify,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const { response: session, refreshToken } = await this.session.verify(
      body.phone,
      body.code,
      request.headers['user-agent'],
    );
    setRefreshCookie(response, refreshToken, {
      maxAgeSeconds: REFRESH_TTL_SECONDS,
      secure: this.secure,
    });
    return session;
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renews the access token and rotates the refresh token',
    description:
      'Uses the refresh cookie. The token that was used stops working; showing it again revokes the whole login.',
  })
  @ApiResponse({ status: 200, ...sessionResponse })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED. The cookie is cleared.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    try {
      const { response: session, refreshToken } = await this.session.refresh(
        readRefreshCookie(request),
        request.headers['user-agent'],
      );
      setRefreshCookie(response, refreshToken, {
        maxAgeSeconds: REFRESH_TTL_SECONDS,
        secure: this.secure,
      });
      return session;
    } catch (error) {
      // A token that is no good is of no use to the browser either.
      if (error instanceof AppError) clearRefreshCookie(response, { secure: this.secure });
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Ends the session' })
  @ApiResponse({ status: 204, description: 'Done, also when there was no session.' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.session.logout(readRefreshCookie(request));
    clearRefreshCookie(response, { secure: this.secure });
  }
}
