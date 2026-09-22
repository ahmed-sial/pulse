import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CACHE = 'REDIS_CACHE';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CACHE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger(RedisCacheModule.name);
        const redis = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get('REDIS_DB', 0),
          retryStrategy: (t) => {
            if (t > 3) return null;
            return Math.min(t * 200, 2000);
          },
        });
        redis.on('connect', () => logger.log('Redis connected successfully'));
        redis.on('error', (err) =>
          logger.error('Redis connection unsuccessful', err.stack),
        );
        return redis;
      },
    },
  ],
  exports: [REDIS_CACHE],
})
export class RedisCacheModule {}
