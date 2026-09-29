import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { REDIS_CACHE } from '../../infra/redis.module.js';
import { Kysely } from 'kysely';
import { IDatabase } from '../../db/infra/db.interface.js';
import { KYSELY_DB } from '../../db/db.module.js';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { MissingEnvVariableException } from '../../exceptions/missing-env-variable.exception.js';
import { createClerkClient } from '@clerk/backend';
import { normalizePlanTier } from '../../utils/normalize-plan.js';
import {
  PLAN_DEFAULTS,
  PLAN_REDIS_TTL,
  planRedisKey,
  PlanTier,
  usageRedisKey,
} from '../../configs/index.js';
import { planCache, usageCache } from '../../guards/usage.guard.js';
import { InitializeOnPreviewAllowlist } from '@nestjs/core';

type PaidPlan = 'starter' | 'pro' | 'business';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<IDatabase>,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    const stripeSecretKey = this.config.getOrThrow<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeSecretKey);
  }

  private isPaidPlan(plan: string) {
    return plan === 'starter' || plan === 'pro' || plan === 'business';
  }

  private getStripePriceId(plan: PaidPlan) {
    const priceIds: Record<PaidPlan, string | undefined> = {
      starter: this.config.get<string>('STRIPE_STARTER_PRICE_ID'),
      pro: this.config.get<string>('STRIPE_PRO_PRICE_ID'),
      business: this.config.get<string>('STRIPE_BUSINESS_PRICE_ID'),
    };
    const priceId = priceIds[plan];
    if (!priceId) {
      throw new MissingEnvVariableException(
        `Missing stripe price id for ${plan}`,
      );
    }
    return priceId;
  }

  private async getClerkUserEmail(userId: string) {
    try {
      const clerk = createClerkClient({
        secretKey: this.config.getOrThrow<string>('CLERK_SECRET_KEY'),
      });
      const user = await clerk.users.getUser(userId);
      const pId = user.primaryEmailAddressId;
      const pEmail = user.emailAddresses.find((e) => e.id === pId);
      return pEmail ?? user.emailAddresses[0].emailAddress ?? undefined;
    } catch {
      return undefined;
    }
  }

  private async findStripeCustomerByEmail(email: string) {
    const customer = await this.stripe.customers.list({
      email,
      limit: 1,
    });
    return customer.data[0];
  }

  private async ensureStripeCustomer(userId: string) {
    const email = (await this.getClerkUserEmail(userId)) as string;
    if (!email)
      throw new NotFoundException(
        "Can't ensure stripe customer. User email is missing",
      );
    const record = await this.db
      .selectFrom('plan')
      .where('user_id', '=', userId)
      .select(['name', 'stripe_customer_id'])
      .executeTakeFirst();
    const stripeCustomer = await this.findStripeCustomerByEmail(email);
    const currentPlan = normalizePlanTier(record?.name);
    if (stripeCustomer) {
      return {
        customerId: stripeCustomer.id,
        currentPlan,
      };
    }
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    });
    return { customerId: customer.id, currentPlan };
  }

  async getCurrentPlan(req: any) {
    const plan = req.plan;
    return { plan };
  }

  async createBillingSession(userId: string, selectedPlan: string) {
    const plan = selectedPlan.toLowerCase();
    if (!this.isPaidPlan(plan)) {
      throw new BadRequestException(
        'Choose starter, pro, or business to create a billing session',
      );
    }
    const priceId = this.getStripePriceId(plan);
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');
    const { customerId } = await this.ensureStripeCustomer(userId);
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId,
          plan,
        },
      },
      success_url: `${appUrl}/settings?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
    });
    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a checkout URL',
      );
    }
    return {
      url: session.url,
    };
  }

  async createPortalSession(userId: string) {
    const { customerId, currentPlan } = await this.ensureStripeCustomer(userId);
    if (currentPlan == PlanTier.FREE) {
      throw new BadRequestException(
        "Free plan users don't have a stripe billing portal.",
      );
    }

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`,
    });

    return {
      url: session.url,
    };
  }

  async getInvoices(userId: string) {
    const invoices = await this.db
      .selectFrom('payment_invoices')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', (o) => o.desc())
      .execute();

    return { invoices };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature)
      throw new BadRequestException('Stripe signature is required');
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret)
      throw new MissingEnvVariableException(
        'STRIPE_WEBHOOK_SECRET is required',
      );
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.activatePlanFromCheckoutSession(
          event.data.object as Stripe.Checkout.Session,
        );
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.activatePlanFromSubscription(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.payment_failed':
      case 'invoice.voided':
        await this.saveInvoice(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.saveInvoice(invoice);
        await this.activatePlanFromInvoice(invoice);
        break;
      }
      default:
        break;
    }
    return { recieved: true };
  }

  private getPlanFromPriceId(stripePriceId?: string) {
    if (!stripePriceId) return PlanTier.FREE;
    const priceIdToPlan: Record<string, PlanTier> = {
      [this.getStripePriceId('starter')]: PlanTier.STARTER,
      [this.getStripePriceId('pro')]: PlanTier.PRO,
      [this.getStripePriceId('business')]: PlanTier.BUSINESS,
    };
    return priceIdToPlan[stripePriceId] ?? PlanTier.FREE;
  }

  private resolvePaidPlan(rawPlan?: string | null, stripePriceId?: string) {
    const plan = normalizePlanTier(rawPlan);
    if (plan !== PlanTier.FREE) return plan;
    return this.getPlanFromPriceId(stripePriceId);
  }

  private async updatePlanSources({
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    updatedAt,
  }: {
    userId: string;
    plan: PlanTier;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    updatedAt: Date;
  }) {
    const lruKey = `plan:${userId}`;
    const redisKey = planRedisKey(userId);
    planCache.set(lruKey, { name: plan });
    await this.redis.hset(redisKey, { name: plan });
    await this.redis.expire(redisKey, PLAN_REDIS_TTL);
    await this.db
      .insertInto('plan')
      .values({
        user_id: userId,
        name: plan,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: stripePriceId,
        created_at: updatedAt,
        updated_at: updatedAt,
      })
      .onConflict((o) =>
        o.column('user_id').doUpdateSet({
          name: plan,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: stripePriceId,
          updated_at: updatedAt,
        }),
      )
      .execute();
  }

  private async activatePaidPlan({
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
  }: {
    userId: string;
    plan: PlanTier;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
  }) {
    const now = new Date();
    const planDefaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS[PlanTier.FREE];
    await this.updatePlanSources({
      userId,
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      updatedAt: now,
    });
  }

  private async activatePlanFromCheckoutSession(
    session: Stripe.Checkout.Session,
  ) {
    const userId = session.client_reference_id || session.metadata?.userId;
    const priceId = session.line_items?.data?.[0]?.price?.id;
    const plan = this.resolvePaidPlan(session.metadata?.plan, priceId);
    if (!userId || plan === PlanTier.FREE) return;

    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    await this.activatePaidPlan({
      userId,
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
    });
  }

  private async updateUsageSources({
    userId,
    eventsLimit,
    updatedAt,
  }: {
    userId: string;
    eventsLimit: bigint;
    updatedAt: Date;
  }) {
    const lruKey = `usage:${userId}`;
    const redisKey = usageRedisKey(userId);
    const currentUsage = usageCache.get(lruKey);
    const record = currentUsage
      ? undefined
      : await this.db
          .selectFrom('usage')
          .select('events_usage')
          .where('user_id', '=', userId)
          .executeTakeFirst();

    const eventsUsed = currentUsage?.events_used ?? record?.events_usage ?? 0n;
    usageCache.set(lruKey, {
      events_used: eventsUsed,
      events_limit: eventsLimit,
    });
    await this.redis.hset(redisKey, {
      events_used: eventsUsed.toString(),
      events_limit: eventsLimit.toString(),
    });
    await this.redis.expire(redisKey, PLAN_REDIS_TTL);

    await this.db
      .insertInto('usage')
      .values({
        user_id: userId,
        events_usage: eventsUsed,
        events_limit: eventsLimit,
        created_at: updatedAt,
        updated_at: updatedAt,
      })
      .onConflict((o) =>
        o.column('user_id').doUpdateSet({
          events_limit: eventsLimit,
          updated_at: updatedAt,
        }),
      )
      .execute();
  }

  private async getUserIdForInvoice(
    invoice: Stripe.Invoice,
    customerId?: string,
    subscriptionId?: string,
  ) {
    const invoiceData = invoice as any;
    const metadataUserId =
      invoice.metadata?.userId ||
      invoiceData.subscription_details?.metadata?.userId ||
      invoiceData.parent?.subscription_details?.metadata?.userId;
    if (metadataUserId) return metadataUserId;
    if (subscriptionId) {
      const plan = await this.db
        .selectFrom('plan')
        .select('user_id')
        .where('stripe_subscription_id', '=', subscriptionId)
        .executeTakeFirst();

      if (plan?.user_id) return plan.user_id;
    }
    if (customerId) {
      const plan = await this.db
        .selectFrom('plan')
        .select('user_id')
        .where('stripe_customer_id', '=', customerId)
        .executeTakeFirst();
      return plan?.user_id;
    }
  }

  private fromUnix(value?: number | null) {
    return value ? new Date(value * 1000) : null;
  }

  private async saveInvoice(invoice: Stripe.Invoice) {
    const invoiceData = invoice as any;
    const stripeInvoiceId = invoice.id;
    if (!stripeInvoiceId) return;
    const stripeCustomerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    const stripeSubscriptionId =
      typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : invoiceData.subscription?.id ||
          invoiceData.parent?.subscription_details?.subscription;
    const userId = await this.getUserIdForInvoice(
      invoice,
      stripeCustomerId,
      stripeSubscriptionId,
    );
    if (!userId) return; // TODO: pending
  }

  private async activatePlanFromSubscription(
    subscription: Stripe.Subscription,
  ) {
    const subData = subscription as any;
    const userId = subscription.metadata?.userId;
    const stripePriceId = subData.items?.data?.[0]?.price?.id;
    const plan = this.resolvePaidPlan(
      subscription.metadata?.plan,
      stripePriceId,
    );
    if (!userId || plan === PlanTier.FREE) return;
    const stripeCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    await this.activatePaidPlan({
      userId,
      plan,
      stripeCustomerId,
      stripePriceId,
      stripeSubscriptionId: subscription.id,
    });
  }

  private async activatePlanFromInvoice(invoice: Stripe.Invoice) {
    const invoiceData = invoice as any;
    const stripeCustomerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    const stripeSubscriptionId =
      typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : invoiceData.subscription?.id ||
          invoiceData.parent?.subscription_details?.subscription;
    const stripePriceId = invoiceData.lines?.data?.[0]?.price?.id;
    const plan = this.resolvePaidPlan(
      invoice.metadata?.plan ||
        invoiceData.subscription_details?.metadata?.plan ||
        invoiceData.parent?.subscription_details?.metadata?.plan,
      stripePriceId,
    );
    const userId = await this.getUserIdForInvoice(
      invoice,
      stripeCustomerId,
      stripeSubscriptionId,
    );
    if (!userId || plan === PlanTier.FREE) return;
    await this.activatePaidPlan({
      userId,
      plan,
      stripeCustomerId,
      stripePriceId,
      stripeSubscriptionId,
    });
  }
}
