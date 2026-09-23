import { clickHouseClient } from './client.js';

export const createLogsTable = async () => {
  await clickHouseClient.command({
    query: `
        CREATE TABLE IF NOT EXISTS logs.events (
            keyId       String,
            userId      String,
            type        LowCardinality(String),
            message     String,
            appName     LowCardinality(String),
            environment LowCardinality(String),
            importance  Nullable(String),
            subsystem   Nullable(String),
            service     Nullable(String),
            operation   Nullable(String),
            track       Nullable(String),
            security    Nullable(String)
            metrics     Nullable(String),
            timestamp   DateTime DEFAULT now(),
            ingested_at DateTime DEFAULT now(),
        )
            ENGINE = MergeTree()
            PARTITION BY toYYYMM(timestamp)
            ORDER BY (timestamp, keyId)
            TTL timestamp + INTERVAL 30 DAY DELETE
            SETTINGS index_granularity = 8192;
        `,
  });
};
