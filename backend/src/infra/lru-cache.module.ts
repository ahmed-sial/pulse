import { Global, Module } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { ILruCache } from '../types/lru-cache.interface.js';

export const LRU_CACHE = 'LRU_CACHE';

@Global()
@Module({
  providers: [
    {
      provide: LRU_CACHE,
      useFactory: () => {
        return new LRUCache<string, ILruCache>({
          max: 10000,
          ttl: 5 * 60 * 1000,
          updateAgeOnGet: true,
          updateAgeOnHas: false,
          allowStale: false,
        });
      },
    },
  ],
  exports: [LRU_CACHE],
})
export class LRUCacheModule {}
