import { Body, Controller, Get, HttpCode, Inject, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  customerProfileUpdateSchema,
  type CustomerProfile,
  type CustomerProfileUpdate,
} from '@fregues/shared';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { CurrentCustomerId, CustomerAuthGuard } from './customer-auth.guard';
import { CustomerProfileService } from './customer-profile.service';

const profileResponse = {
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      phone: { type: 'string', example: '+5511912345678' },
      name: { type: 'string', nullable: true },
      email: { type: 'string', nullable: true },
      profileComplete: { type: 'boolean' },
      termsAcceptedAt: { type: 'string', format: 'date-time', nullable: true },
      termsVersion: { type: 'string', nullable: true, example: '2026-10-01' },
    },
  },
} as const;

@ApiTags('customer')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('customer/me')
export class CustomerProfileController {
  constructor(@Inject(CustomerProfileService) private readonly profile: CustomerProfileService) {}

  @Get()
  @ApiOperation({ summary: 'The profile of the signed in customer' })
  @ApiResponse({ status: 200, ...profileResponse })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED or TOKEN_EXPIRED' })
  get(@CurrentCustomerId() customerId: string): Promise<CustomerProfile> {
    return this.profile.get(customerId);
  }

  @Patch()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Finishes or edits the profile',
    description:
      'At the first access the app sends only `name` and `acceptTerms: true` (RN-ENT-07, RN-ENT-08). ' +
      'The phone cannot be changed. `email: null` removes the e-mail.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Carlos Mendes' },
        email: { type: 'string', nullable: true, example: 'carlos@exemplo.com' },
        acceptTerms: { type: 'boolean', enum: [true] },
        termsVersion: { type: 'string', example: '2026-10-01' },
      },
    },
  })
  @ApiResponse({ status: 200, ...profileResponse })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED or TOKEN_EXPIRED' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR (`details.fields`)' })
  update(
    @CurrentCustomerId() customerId: string,
    @Body(new ZodValidationPipe(customerProfileUpdateSchema)) body: CustomerProfileUpdate,
  ): Promise<CustomerProfile> {
    return this.profile.update(customerId, body);
  }
}
