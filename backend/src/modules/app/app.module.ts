import { Module } from '@nestjs/common';
import { LRUCacheModule } from '../../infra/lru-cache.module.js';
import { RedisCacheModule } from '../../infra/redis.module.js';
import { DatabaseModule } from '../../db/db.module.js';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClerkClientProvider } from '../auth/clerk.provider.js';
import { APP_GUARD } from '@nestjs/core';
import { ClerkOrApiKeyAuthGuard } from '../../guards/clerk-or-api-key-auth.guard.js';
import { ApiKeyAuthGuard } from '../../guards/api-key-auth.guard.js';
import { AppLogsModule } from '../app-logs/app-logs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    DatabaseModule,
    LRUCacheModule,
    RedisCacheModule,
    ApiKeyModule,
    AppLogsModule,
  ],
  controllers: [],
  providers: [
    ClerkClientProvider,
    {
      provide: APP_GUARD,
      useClass: ClerkOrApiKeyAuthGuard,
    },
    ApiKeyAuthGuard,
    ClerkOrApiKeyAuthGuard,
  ],
})
export class AppModule {}
