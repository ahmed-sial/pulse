import { Inject, Injectable } from '@nestjs/common';
import { KYSELY_DB } from '../db/db.module.js';
import { Kysely } from 'kysely';
import { IDatabase } from '../db/infra/db.interface.js';
import { REDIS_CACHE } from '../infra/redis.module.js';
import { Redis } from 'ioredis';
import { Cron } from '@nestjs/schedule';
import { USAGE_DIRTY_KEY, usageRedisKey } from '../configs/index.js';

@Injectable()
export class UsageDbSyncSchedular {
  constructor(
    @Inject(KYSELY_DB) private readonly db: Kysely<IDatabase>,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  @Cron('*/5 * * * *')
  async flushUsage() {
    const processingKey = `${USAGE_DIRTY_KEY}:processing:${Date.now()}`;
    const renamed = await this.redis
      .rename(USAGE_DIRTY_KEY, processingKey)
      .catch(() => null);
    if (!renamed) return null;
    const userIds = await this.redis.smembers(processingKey);
    let syncedUsers = 0;
    for (const userId of userIds) {
      const usage = await this.redis.hgetall(usageRedisKey(userId));
      if (!usage.events_used) continue;
      await this.db
        .updateTable('usage')
        .set({
          events_usage: BigInt(usage.events_used),
          events_limit: BigInt(usage.events_limit),
        })
        .where('user_id', '=', userId)
        .execute();
      syncedUsers++;
    }
    await this.redis.del(processingKey);
  }
}
