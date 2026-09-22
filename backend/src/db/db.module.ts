import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabase } from './infra/db.factory.js';

export const KYSELY_DB = 'KYSELY_DB';
@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connStr = config.getOrThrow<string>('DB_URL');
        return createDatabase(connStr);
      },
    },
  ],
  exports: [KYSELY_DB],
})
export class DatabaseModule {}
