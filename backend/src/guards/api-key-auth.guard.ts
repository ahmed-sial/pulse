import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  addUuidDashes,
  digestApiKey,
  extractApiKeyId,
  isApiKeySyntaxValid,
} from '../utils/api-key.utils.js';
import * as argon2 from 'argon2';
import { LRUCache } from 'lru-cache';
import { Redis } from 'ioredis';
import { Kysely } from 'kysely';
import { ILruCache } from '../types/lru-cache.interface.js';
import {
  CACHE_KEY_VERSION,
  API_KEY_LAST_USED_DEBOUNCE_SEC,
  API_KEY_LAST_USED_HASH_KEY,
  API_KEY_LRU_TTL,
  API_KEY_REDIS_TTL,
} from '../configs/index.js';
import { KYSELY_DB } from '../db/db.module.js';
import { REDIS_CACHE } from '../infra/redis.module.js';
import { LRU_CACHE } from '../infra/lru-cache.module.js';
import { IDatabase } from '../db/infra/db.interface.js';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyAuthGuard.name, {
    timestamp: true,
  });
  constructor(
    @Inject(KYSELY_DB) private db: Kysely<IDatabase>,
    @Inject(REDIS_CACHE) private redis: Redis,
    @Inject(LRU_CACHE) private lruCache: LRUCache<string, ILruCache>,
  ) {}

  // Sets lock for API key lastUsedAt with debounce rate of 60s.
  // If the API is hit with in 60s, the lastUsedAt property will
  // not be updated in redis, otherwise it is updated.
  private async trackApiKeyLastUsedAt(apiKeyId: string) {
    const lockKey = `pls:api_key:last_used_at_lock:${CACHE_KEY_VERSION}:${apiKeyId}`;
    const isOk = await this.redis.set(
      lockKey,
      '1',
      'EX',
      API_KEY_LAST_USED_DEBOUNCE_SEC,
      'NX',
    );
    if (!isOk) return;
    await this.redis.hset(
      API_KEY_LAST_USED_HASH_KEY,
      apiKeyId,
      Date.now().toString(),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;
    if (isApiKeySyntaxValid(apiKey)) {
      const apiKeyId = addUuidDashes(extractApiKeyId(apiKey));
      const digestedApiKey = digestApiKey(apiKey);
      const lruKey = `${CACHE_KEY_VERSION}:${apiKeyId}`;
      const now = Date.now();
      try {
        const lruCacheValue = this.lruCache.get(lruKey);
        if (
          lruCacheValue &&
          lruCacheValue.expiresAt > now &&
          lruCacheValue.digestedApiKey === digestedApiKey
        ) {
          request.apiKeyId = apiKeyId;
          request.userId = lruCacheValue.userId;
          // await keyword is not used here,
          // because it is a guard not an API endpoint, so we should
          // never wait for API key lastUsedAt property to be updated first
          // and then run remaing logic. We are not doing it async rather
          // we are doing it in background.
          // Simple it means call this async function but we don't care about its
          // promise
          void this.trackApiKeyLastUsedAt(apiKeyId);
          return true;
        }
        const redisKey = `pls:api_key:${CACHE_KEY_VERSION}:${apiKeyId}`;
        const redisCacheValue = await this.redis.hgetall(redisKey);
        if (redisCacheValue?.invalid === '1')
          throw new UnauthorizedException('Unauthorized');

        if (
          redisCacheValue?.digestedApiKey &&
          redisCacheValue?.digestedApiKey !== digestedApiKey
        )
          throw new UnauthorizedException('Unauthorized');

        if (redisCacheValue?.userId) {
          this.lruCache.set(lruKey, {
            userId: redisCacheValue.userId,
            expiresAt: Date.now() + API_KEY_LRU_TTL,
            digestedApiKey,
          });
          request.apiKeyId = apiKeyId;
          request.userId = redisCacheValue.userId;
          void this.trackApiKeyLastUsedAt(apiKeyId);
          return true;
        }
        const apiKeyRecord = await this.db
          .selectFrom('api_keys')
          .where('id', '=', apiKeyId)
          .where('revoked_at', 'is', null)
          .select(['hashed_key', 'user_id', 'revoked_at'])
          .executeTakeFirst();
        if (!apiKeyRecord) {
          throw new UnauthorizedException('Unauthorized');
        }
        const isApiKeyValid = await argon2.verify(
          apiKeyRecord.hashed_key,
          apiKey,
        );
        if (!isApiKeyValid) {
          await this.redis.hset(redisKey, {
            invalid: '1',
          });
          await this.redis.expire(redisKey, API_KEY_REDIS_TTL);
          throw new UnauthorizedException('Unauthorized');
        }
        await this.redis.hset(redisKey, {
          userId: apiKeyRecord.user_id,
          digestedApiKey,
        });
        await this.redis.expire(redisKey, API_KEY_REDIS_TTL);
        this.lruCache.set(lruKey, {
          userId: apiKeyRecord.user_id,
          expiresAt: Date.now() + API_KEY_LRU_TTL,
          digestedApiKey,
        });
        request.apiKeyId = apiKeyId;
        request.userId = apiKeyRecord.user_id;
        void this.trackApiKeyLastUsedAt(apiKeyId);
        return true;
      } catch (err) {
        this.logger.error(
          `Authorization error: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new UnauthorizedException('Unauthorized');
      }
    }
    return false;
  }
}
