import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { KYSELY_DB } from '../db/db.module.js';
import { Kysely } from 'kysely';
import { IDatabase } from '../db/infra/db.interface.js';
import { REDIS_CACHE } from '../infra/redis.module.js';
import { Redis } from 'ioredis';
import {
  hardLockRedisKey,
  PLAN_DEFAULTS,
  PLAN_LRU_TTL,
  PLAN_REDIS_TTL,
  planRedisKey,
  PlanTier,
  usageRedisKey,
} from '../configs/index.js';
import { LRUCache } from 'lru-cache/raw';
import { normalizePlanTier } from '../utils/normalize-plan.js';

export type CachedPlan = {
  name: PlanTier;
};

export type CachedUsage = {
  events_used: bigint;
  events_limit: bigint;
};

export const planCache = new LRUCache<string, CachedPlan>({
  max: 50_000,
  ttl: PLAN_LRU_TTL,
  updateAgeOnGet: true,
  allowStale: false,
});
export const usageCache = new LRUCache<string, CachedUsage>({
  max: 50_000,
  ttl: PLAN_LRU_TTL,
  updateAgeOnGet: true,
  allowStale: false,
});

@Injectable()
export class UsageGuard implements CanActivate {
  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<IDatabase>,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  private async isHardLocked(userId: string) {
    return (await this.redis.exists(hardLockRedisKey(userId))) === 1;
  }

  private async getOrCreateUsage(userId: string) {
    // parameter planDefaults
    const lruKey = `usage:${userId}`;
    const cached = usageCache.get(lruKey);
    if (cached) return cached;

    const rKey = usageRedisKey(userId);
    const rUsage = await this.redis.hgetall(rKey);

    if (rUsage?.events_used !== undefined) {
      void this.redis.expire(rKey, PLAN_REDIS_TTL);
      const entry: CachedUsage = {
        events_used: BigInt(rUsage.events_used),
        events_limit: BigInt(
          rUsage.events_limit ?? PLAN_DEFAULTS.free.events_limit,
        ),
      };
      usageCache.set(lruKey, entry);
      return entry;
    }

    const record = await this.db
      .selectFrom('usage')
      .select(['events_usage', 'events_limit'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!record) {
      const entry = {
        events_used: 0n,
        events_limit: BigInt(PLAN_DEFAULTS[PlanTier.FREE].events_limit),
      };

      await this.db
        .insertInto('usage')
        .values({
          user_id: userId,
          events_usage: 0n,
          events_limit: BigInt(PLAN_DEFAULTS[PlanTier.FREE].events_limit),
        })
        .onConflict((oc) => oc.doNothing())
        .execute();

      await this.redis.hset(rKey, {
        events_used: entry.events_used.toString(),
        events_limit: entry.events_limit.toString(),
      });

      await this.redis.expire(rKey, PLAN_REDIS_TTL);
      usageCache.set(lruKey, entry);
      return entry;
    }

    const entry: CachedUsage = {
      events_used: BigInt(record?.events_usage ?? 0),
      events_limit: BigInt(record?.events_limit ?? 0),
    };
    await this.redis.hset(rKey, {
      events_used: entry.events_used.toString(),
      events_limit: entry.events_limit.toString(),
    });
    await this.redis.expire(rKey, PLAN_REDIS_TTL);
    usageCache.set(lruKey, entry);
    return entry;
  }

  private async resolvePlan(userId: string) {
    const lruKey = `plan:${userId}`;
    const cached = planCache.get(lruKey);
    if (cached) return cached;
    const rKey = planRedisKey(userId);
    const rPlan = await this.redis.hgetall(rKey);
    if (rPlan?.name) {
      void this.redis.expire(rKey, PLAN_REDIS_TTL);
      const entry: CachedPlan = { name: normalizePlanTier(rPlan.name) };
      planCache.set(lruKey, entry);
      return entry;
    }
    const record = await this.db
      .selectFrom('plan')
      .select('name')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const planName = normalizePlanTier(record?.name);
    const entry: CachedPlan = { name: planName };
    await this.redis.hset(rKey, { name: planName });
    await this.redis.expire(rKey, PLAN_REDIS_TTL);
    planCache.set(lruKey, entry);
    return entry;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request?.userId ?? request?.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthorized');
    if (await this.isHardLocked(userId))
      throw new ForbiddenException(
        'Your account has been locked. You have exceeded the usage limit for your current plan. Please upgrade your plan',
      );

    const plan = await this.resolvePlan(userId);
    request.plan = plan.name;
    const planDefaults =
      PLAN_DEFAULTS[plan.name] ?? PLAN_DEFAULTS[PlanTier.FREE];

    const usage = await this.getOrCreateUsage(userId); // parameter planDefaults

    const effectiveUsageLimit =
      usage.events_limit > 0n
        ? usage.events_limit
        : BigInt(planDefaults.events_limit);
    if (usage.events_used >= effectiveUsageLimit)
      throw new ForbiddenException(
        'You have reached your usage quota. Please upgrade you plan',
      );
    return true;
  }
}
