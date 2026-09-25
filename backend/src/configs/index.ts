export const CACHE_KEY_VERSION = 'v1';
export const API_KEY_LRU_TTL = 5 * 60 * 1000;
export const API_KEY_REDIS_TTL = 10 * 60;
export const API_KEY_LAST_USED_DEBOUNCE_SEC = 60;
export const API_KEY_LAST_USED_HASH_KEY = `pls:api_key:last_used:${CACHE_KEY_VERSION}`;

export const PLAN_LRU_TTL = 5 * 60 * 1000;
export const PLAN_REDIS_TTL = 6 * 60;
export const QUERY_MAX_LIMIT = 500;
