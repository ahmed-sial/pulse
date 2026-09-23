import { createClient } from '@clickhouse/client';
import { Logger } from '@nestjs/common';
import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = {
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER,
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
  CLICKHOUSE_DB: process.env.CLICKHOUSE_DB,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

const logger = new Logger('ClickHouseClient', { timestamp: true });

if (missingVars.length > 0) {
  logger.error(
    `Missing required ClickHouse env variables: ${missingVars.join(', ')}`,
  );
  logger.warn(
    `Using default values - this may cause connection issues in production`,
  );
}

export const clickHouseClient = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'logs',
});
