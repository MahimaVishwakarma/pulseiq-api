import { Controller, Get, Post, Body, UseGuards, Req, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId, CurrentUser } from '../../common/decorators/workspace.decorator';
import type { User } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(private service: BillingService) {}

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.service.handleWebhook(req.rawBody!, sig);
  }

  @Get('workspaces/:workspaceId/billing/plan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiOperation({ summary: 'Get current plan' })
  plan(@WorkspaceId() wsId: string) {
    return this.service.getCurrentPlan(wsId);
  }

  @Post('workspaces/:workspaceId/billing/checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  checkout(
    @WorkspaceId() wsId: string,
    @CurrentUser() user: User,
    @Body('priceId') priceId: string,
  ) {
    return this.service.createCheckoutSession(wsId, priceId, user.id);
  }

  @Post('workspaces/:workspaceId/billing/portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiOperation({ summary: 'Open Stripe billing portal' })
  portal(@WorkspaceId() wsId: string) {
    return this.service.createPortalSession(wsId);
  }
}
