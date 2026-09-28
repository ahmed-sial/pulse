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
import { PlanTier } from '../../configs/index.js';

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
}
