import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { PlanTier } from '@prisma/client';

const PLAN_LIMITS: Record<PlanTier, { maxInboxes: number; maxLeads: number; maxCampaigns: number }> = {
  STARTER: { maxInboxes: 5, maxLeads: 500, maxCampaigns: 3 },
  GROWTH: { maxInboxes: 25, maxLeads: 5000, maxCampaigns: 20 },
  ENTERPRISE: { maxInboxes: 200, maxLeads: 100000, maxCampaigns: 999 },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.stripe = new Stripe(config.get<string>('stripe.secretKey') ?? '');
  }

  async createCheckoutSession(workspaceId: string, priceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new BadRequestException('Workspace not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user?.email,
        metadata: { workspaceId, userId },
      });
      customerId = customer.id;
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.config.get('frontendUrl')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.get('frontendUrl')}/billing`,
      metadata: { workspaceId },
    });

    return { url: session.url };
  }

  async createPortalSession(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace?.stripeCustomerId) throw new BadRequestException('No billing account found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${this.config.get('frontendUrl')}/settings/billing`,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const secret = this.config.get<string>('stripe.webhookSecret') ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleSubscriptionChange(sub: Stripe.Subscription) {
    const workspaceId = sub.metadata.workspaceId;
    if (!workspaceId) return;

    const priceId = sub.items.data[0]?.price.id;
    const tier = this.priceToTier(priceId);
    const limits = PLAN_LIMITS[tier];

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { planTier: tier, stripeSubId: sub.id, ...limits },
    });
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const workspaceId = sub.metadata.workspaceId;
    if (!workspaceId) return;

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { planTier: PlanTier.STARTER, stripeSubId: null, ...PLAN_LIMITS.STARTER },
    });
  }

  private priceToTier(priceId?: string): PlanTier {
    const prices = this.config.get<Record<string, string>>('stripe.prices') ?? {};
    if (priceId === prices.growth) return PlanTier.GROWTH;
    if (priceId === prices.enterprise) return PlanTier.ENTERPRISE;
    return PlanTier.STARTER;
  }

  async getCurrentPlan(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planTier: true, maxInboxes: true, maxLeads: true, maxCampaigns: true, stripeSubId: true },
    });
    return ws;
  }
}
