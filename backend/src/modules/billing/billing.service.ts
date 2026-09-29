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

  private isPaidPlan(plan: string | undefined): plan is PaidPlan {
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
      return pEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
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
    const email = await this.getClerkUserEmail(userId);
    if (!email)
      throw new NotFoundException(
        "Can't ensure stripe customer. User email is missing",
      );
    const record = await this.db
      .selectFrom('plan')
      .where('user_id', '=', userId)
      .select(['name', 'stripe_customer_id'])
      .executeTakeFirst();
    const currentPlan = normalizePlanTier(record?.name);
    if (record?.stripe_customer_id) {
      return { customerId: record.stripe_customer_id, currentPlan };
    }
    const stripeCustomer = await this.findStripeCustomerByEmail(email);
    if (stripeCustomer) {
      await this.storeCustomerId(userId, stripeCustomer.id);
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
    await this.storeCustomerId(userId, customer.id);
    return { customerId: customer.id, currentPlan };
  }

  private async storeCustomerId(userId: string, customerId: string) {
    const now = new Date();
    await this.db
      .insertInto('plan')
      .values({
        user_id: userId,
        name: PlanTier.FREE,
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        stripe_price_id: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          stripe_customer_id: customerId,
          updated_at: now,
        }),
      )
      .execute();
  }

  async getPlans() {
    const tiers: PaidPlan[] = ['starter', 'pro', 'business'];
    const paid = await Promise.all(
      tiers.map(async (name) => {
        const price = await this.stripe.prices.retrieve(
          this.getStripePriceId(name),
        );
        return {
          name,
          eventsLimit: PLAN_DEFAULTS[name].events_limit,
          unitAmount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
          intervalCount: price.recurring?.interval_count ?? null,
        };
      }),
    );
    return {
      plans: [
        {
          name: PlanTier.FREE,
          eventsLimit: PLAN_DEFAULTS.free.events_limit,
          unitAmount: 0,
          currency: null,
          interval: null,
          intervalCount: null,
        },
        ...paid,
      ],
    };
  }

  async getCurrentPlan(userId: string) {
    const [planRecord, usageRecord, cachedUsage] = await Promise.all([
      this.db
        .selectFrom('plan')
        .select('name')
        .where('user_id', '=', userId)
        .executeTakeFirst(),
      this.db
        .selectFrom('usage')
        .select(['events_usage', 'events_limit'])
        .where('user_id', '=', userId)
        .executeTakeFirst(),
      this.redis.hgetall(usageRedisKey(userId)),
    ]);
    const plan = normalizePlanTier(planRecord?.name);
    const eventsUsed =
      cachedUsage.events_used ?? usageRecord?.events_usage ?? 0;
    const eventsLimit =
      cachedUsage.events_limit ??
      usageRecord?.events_limit ??
      PLAN_DEFAULTS[plan].events_limit;
    return {
      plan,
      usage: {
        eventsUsed: String(eventsUsed),
        eventsLimit: String(eventsLimit),
      },
    };
  }

  async createBillingSession(userId: string, selectedPlan: string) {
    const plan =
      typeof selectedPlan === 'string' ? selectedPlan.toLowerCase() : undefined;
    if (!this.isPaidPlan(plan)) {
      throw new BadRequestException(
        'Choose starter, pro, or business to create a billing session',
      );
    }
    const priceId = this.getStripePriceId(plan);
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const { customerId, currentPlan } = await this.ensureStripeCustomer(userId);
    if (currentPlan !== PlanTier.FREE) {
      throw new BadRequestException(
        'Manage plan changes in the billing portal',
      );
    }
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
      success_url: `${appUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
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

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });

    return {
      url: session.url,
    };
  }

  async confirmCheckout(userId: string, sessionId?: string) {
    const record = await this.db
      .selectFrom('plan')
      .select([
        'name',
        'stripe_customer_id',
        'stripe_subscription_id',
        'stripe_price_id',
      ])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    const customerId = record?.stripe_customer_id;
    if (!customerId) return { status: 'pending' as const };

    let subscription: Stripe.Subscription | undefined;
    if (sessionId !== undefined) {
      if (
        typeof sessionId !== 'string' ||
        !/^cs_(test_|live_)[a-zA-Z0-9]+$/.test(sessionId)
      ) {
        throw new BadRequestException('Invalid checkout session ID');
      }
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      const sessionCustomerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;
      if (
        session.client_reference_id !== userId ||
        sessionCustomerId !== customerId
      ) {
        throw new BadRequestException(
          'Checkout session does not belong to this account',
        );
      }
      if (
        session.mode !== 'subscription' ||
        session.status !== 'complete' ||
        (session.payment_status !== 'paid' &&
          session.payment_status !== 'no_payment_required')
      ) {
        return { status: 'pending' as const };
      }
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId) return { status: 'pending' as const };
      subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    } else {
      // Also supports a checkout created before the success URL included a session ID.
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      });
      subscription = subscriptions.data
        .filter(
          (item) => item.status === 'active' || item.status === 'trialing',
        )
        .sort((a, b) => b.created - a.created)
        .find(
          (item) =>
            this.getPlanFromPriceId(item.items.data[0]?.price.id) !==
            PlanTier.FREE,
        );
    }

    if (
      !subscription ||
      (subscription.status !== 'active' && subscription.status !== 'trialing')
    ) {
      return { status: 'pending' as const };
    }
    const subscriptionCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    if (subscriptionCustomerId !== customerId) {
      throw new BadRequestException(
        'Subscription does not belong to this account',
      );
    }
    const priceId = subscription.items.data[0]?.price.id;
    const plan = this.getPlanFromPriceId(priceId);
    if (plan === PlanTier.FREE) return { status: 'pending' as const };

    // Do not let a revisit to an older Checkout URL replace a newer subscription.
    if (
      record.stripe_subscription_id &&
      record.stripe_subscription_id !== subscription.id &&
      normalizePlanTier(record.name) !== PlanTier.FREE
    ) {
      return {
        status: 'confirmed' as const,
        plan: normalizePlanTier(record.name),
      };
    }
    if (
      record.stripe_subscription_id !== subscription.id ||
      normalizePlanTier(record.name) !== plan ||
      record.stripe_price_id !== priceId
    ) {
      await this.activatePaidPlan({
        userId,
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
      });
    }
    if (subscription.latest_invoice) {
      const invoice =
        typeof subscription.latest_invoice === 'string'
          ? await this.stripe.invoices.retrieve(subscription.latest_invoice)
          : subscription.latest_invoice;
      await this.saveInvoice(invoice);
    }
    return { status: 'confirmed' as const, plan };
  }

  async getInvoices(userId: string) {
    const invoices = await this.db
      .selectFrom('payment_invoices')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', (o) => o.desc())
      .execute();

    return {
      invoices: invoices.map((invoice) => ({
        ...invoice,
        amount_due: invoice.amount_due?.toString() ?? null,
        amount_paid: invoice.amount_paid?.toString() ?? null,
      })),
    };
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
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.activatePlanFromSubscription(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.deactivateSubscription(
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
        stripe_customer_id: stripeCustomerId ?? null,
        stripe_subscription_id: stripeSubscriptionId ?? null,
        stripe_price_id: stripePriceId ?? null,
        created_at: updatedAt,
        updated_at: updatedAt,
      })
      .onConflict((o) =>
        o.column('user_id').doUpdateSet({
          name: plan,
          stripe_customer_id: stripeCustomerId ?? null,
          stripe_subscription_id: stripeSubscriptionId ?? null,
          stripe_price_id: stripePriceId ?? null,
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
    await this.updatePlanSources({
      userId,
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      updatedAt: now,
    });
    await this.updateUsageSources({
      userId,
      eventsLimit: BigInt(PLAN_DEFAULTS[plan].events_limit),
      updatedAt: now,
    });
  }

  private async deactivateSubscription(subscription: Stripe.Subscription) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    const record = await this.db
      .selectFrom('plan')
      .select(['user_id', 'stripe_customer_id'])
      .where('stripe_subscription_id', '=', subscription.id)
      .executeTakeFirst();
    const userId = record?.user_id ?? subscription.metadata?.userId;
    if (!userId) return;
    // A delayed deletion event must not downgrade a newer subscription.
    const current = await this.db
      .selectFrom('plan')
      .select('stripe_subscription_id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (current?.stripe_subscription_id !== subscription.id) return;
    await this.updatePlanSources({
      userId,
      plan: PlanTier.FREE,
      stripeCustomerId: customerId ?? record?.stripe_customer_id ?? undefined,
      updatedAt: new Date(),
    });
    await this.updateUsageSources({
      userId,
      eventsLimit: BigInt(PLAN_DEFAULTS.free.events_limit),
      updatedAt: new Date(),
    });
  }

  private async activatePlanFromCheckoutSession(
    session: Stripe.Checkout.Session,
  ) {
    if (session.payment_status === 'unpaid') return;
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

    const redisUsed = await this.redis.hget(redisKey, 'events_used');
    const eventsUsed =
      redisUsed !== null
        ? BigInt(redisUsed)
        : BigInt(currentUsage?.events_used ?? record?.events_usage ?? 0);
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
    if (!userId) return;
    const now = new Date();
    const values = {
      user_id: userId,
      stripe_customer_id: stripeCustomerId ?? null,
      stripe_subscription_id: stripeSubscriptionId ?? null,
      stripe_invoice_id: stripeInvoiceId,
      status: invoice.status ?? null,
      currency: invoice.currency ?? null,
      amount_due:
        invoice.amount_due == null ? null : BigInt(invoice.amount_due),
      amount_paid:
        invoice.amount_paid == null ? null : BigInt(invoice.amount_paid),
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf: invoice.invoice_pdf ?? null,
      period_start: this.fromUnix(invoice.period_start),
      period_end: this.fromUnix(invoice.period_end),
      created_at: this.fromUnix(invoice.created) ?? now,
      updated_at: now,
    };
    await this.db
      .insertInto('payment_invoices')
      .values(values)
      .onConflict((oc) =>
        oc.column('stripe_invoice_id').doUpdateSet({
          status: values.status,
          amount_due: values.amount_due,
          amount_paid: values.amount_paid,
          hosted_invoice_url: values.hosted_invoice_url,
          invoice_pdf: values.invoice_pdf,
          period_start: values.period_start,
          period_end: values.period_end,
          updated_at: now,
        }),
      )
      .execute();
  }

  private async activatePlanFromSubscription(
    subscription: Stripe.Subscription,
  ) {
    if (subscription.status !== 'active' && subscription.status !== 'trialing')
      return;
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
