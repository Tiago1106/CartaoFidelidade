import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  joinBusinessSchema,
  type EnrollmentDetailResponse,
  type EnrollmentList,
  type JoinBusiness,
  type JoinBusinessResponse,
  type PublicBusiness,
} from '@fregues/shared';
import { CurrentCustomerId, CustomerAuthGuard } from '../customer-auth/customer-auth.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { CustomerEnrollmentsService } from './customer-enrollments.service';

@ApiTags('customer')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('customer')
export class CustomerEnrollmentsController {
  constructor(
    @Inject(CustomerEnrollmentsService) private readonly enrollments: CustomerEnrollmentsService,
  ) {}

  @Get('enrollments')
  @ApiOperation({
    summary: 'The cards of the customer (Home)',
    description:
      'Progress, validity and available prizes. An expired cycle shows 0 of N (RN-VAL-02). ' +
      'The app asks again every 5 seconds in the foreground (RN-PRE-07).',
  })
  @ApiResponse({ status: 200, description: '`{ items: Enrollment[] }`' })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED or TOKEN_EXPIRED' })
  list(@CurrentCustomerId() customerId: string): Promise<EnrollmentList> {
    return this.enrollments.list(customerId);
  }

  @Get('enrollments/:id')
  @ApiOperation({
    summary: 'One card with its visits, prizes and past cycles',
    description: 'Never shows the reason of a reversal (RN-PRE-08).',
  })
  @ApiResponse({
    status: 200,
    description: 'The item of the list plus `stamps`, `redemptions` and `pastCycles`.',
  })
  @ApiResponse({ status: 404, description: 'NOT_FOUND, also for the card of somebody else.' })
  detail(
    @CurrentCustomerId() customerId: string,
    @Param('id') id: string,
  ): Promise<EnrollmentDetailResponse> {
    return this.enrollments.detail(customerId, id);
  }

  @Post('businesses/:slug/join')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enters the active cards of a business',
    description:
      'Idempotent. `programIds` limits the cards (default: all the active ones). ' +
      '`marketingOptIn` starts false and counts only when ticked (RN-LGP-03).',
  })
  @ApiResponse({ status: 200, description: '`{ enrollments: Enrollment[] }`' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND: the business or a card does not exist.' })
  @ApiResponse({ status: 409, description: 'PROGRAM_NOT_ACTIVE: a card asked for is archived.' })
  join(
    @CurrentCustomerId() customerId: string,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(joinBusinessSchema)) body: JoinBusiness,
  ): Promise<JoinBusinessResponse> {
    return this.enrollments.join(customerId, slug, body);
  }
}

@ApiTags('public')
@Controller('public/businesses')
export class PublicBusinessController {
  constructor(
    @Inject(CustomerEnrollmentsService) private readonly enrollments: CustomerEnrollmentsService,
  ) {}

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'The page of a business (`/s/<slug>`, RN-ENT-02)',
    description: 'Public. Shows the name and the active cards, nothing about customers or staff.',
  })
  @ApiResponse({ status: 404, description: 'NOT_FOUND: the slug does not exist.' })
  get(@Param('slug') slug: string): Promise<PublicBusiness> {
    return this.enrollments.publicBusiness(slug);
  }
}
