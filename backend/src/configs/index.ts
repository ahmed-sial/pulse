export const CACHE_KEY_VERSION = 'v1';
export const API_KEY_LRU_TTL = 5 * 60 * 1000;
export const API_KEY_REDIS_TTL = 10 * 60;
export const API_KEY_LAST_USED_DEBOUNCE_SEC = 60;
export const API_KEY_LAST_USED_HASH_KEY = `pls:api_key:last_used:${CACHE_KEY_VERSION}`;

export const PLAN_LRU_TTL = 5 * 60 * 1000;
export const PLAN_REDIS_TTL = 6 * 60;
export const QUERY_MAX_LIMIT = 500;

export const hardLockRedisKey = (userId: string) => `user:${userId}:locked`;
export const planRedisKey = (userId: string) =>
  `pls:plan:${CACHE_KEY_VERSION}:${userId}`;
export const usageRedisKey = (userId: string) =>
  `pls:usage:${CACHE_KEY_VERSION}:${userId}`;

export enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  BUSINESS = 'business',
}

export const PLAN_DEFAULTS: Record<PlanTier, { events_limit: number }> = {
  [PlanTier.FREE]: { events_limit: 10000 },
  [PlanTier.STARTER]: { events_limit: 100000 },
  [PlanTier.PRO]: { events_limit: 500000 },
  [PlanTier.BUSINESS]: { events_limit: 1000000 },
};
