import { consumerOpts } from 'nats';
import { getNats } from './index.js';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { clickHouseClient } from '../clickhouse/client.js';
import { broadCastLogsToClient } from '../sse/sse-registry.js';
dotenv.config();

const logger = new Logger('NatsJetstreamConsumer', { timestamp: true });

const redis = new Redis({
  host: process.env.REDIS_HOST || '',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: Number(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: 5,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) return true;
    return false;
  },
  retryStrategy(times) {
    const delay = Math.min(times * 200, 10000);
    return delay;
  },
});

const importanceMap: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

let lastBacklogUpdate = 0;

function toImportance(input: any): number | null {
  if (typeof input === 'number') return input;
  if (typeof input === 'string') {
    const v = importanceMap[input.toLowerCase()];
    return v ?? null;
  }
  return null;
}

export async function startLogsConsumer() {
  const { nc, jc } = await getNats();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  const durable = 'pls-log-worker';
  const subject = 'logs.ingest';
  const streamName = 'PLS_LOGS';

  const opts = consumerOpts();
  opts.durable(durable);
  opts.manualAck();
  opts.ackExplicit();
  opts.deliverTo('pls.logs.worker');

  try {
    const existing = await jsm.consumers.info(streamName, durable);
    const config: any = (existing as any)?.config;
    if (config && !config.deliver_subject) {
      logger.warn(
        `Jetstream consumer ${streamName}:${durable} is pull-based consumer (missing deliver_subject). Recreating as push consumer`,
      );
      await jsm.consumers.delete(streamName, durable);
    }
  } catch (err) {
    logger.error(`Failed to inspect consumer ${durable}`, err);
  }
  const sub = await js.subscribe(subject, opts);
  logger.log('PLS Logs consumer started successfully');

  for await (const msg of sub) {
    try {
      const data = jc.decode(msg.data);
      const { keyId, userId, logs, serverReceivedAt } = data as any;
      const now = Date.now();
      const transformed = logs.map((log: any) => {
        const now = Date.now();
        const latency = now - serverReceivedAt;
        redis.lpush('ingest:latency', latency);
        redis.ltrim('ingest:latency', 0, 59);
        const ts = log?.timestamps?.event_time
          ? new Date(log?.timestamps?.event_time)
          : new Date();
        return {
          keyId,
          userId,
          type: log.type,
          message: log.message,
          service: log.service,
          appName: log.appName,
          environment: log.environment,
          importance: toImportance(log.importance),
          subsystem: log.subsystem ?? null,
          operation: log.operation ?? null,
          track: log.track ? JSON.stringify(log.track) : null,
          security: log.security ? JSON.stringify(log.security) : null,
          metrics: log.metrics ? JSON.stringify(log.metrics) : null,
          timestamp: ts.toISOString().slice(0, 19).replace('T', ' '),
        };
      });
      await clickHouseClient.insert({
        table: 'logs.events',
        values: transformed,
        format: 'JSONEachRow',
      });

      broadCastLogsToClient(transformed);

      msg.ack();
      if (now - lastBacklogUpdate > 1000) {
        lastBacklogUpdate = now;
        const info = await jsm.consumers.info(streamName, durable);
        const backlog =
          (info as any)?.num_pending ??
          (info as any)?.num_ack_pending ??
          (info as any)?.numAckPending ??
          0;
        await redis.set('ingest:backlog', backlog);
      }
    } catch (err) {
      msg.nak();
      logger.error('Consumer error: ', err);
    }
  }
}
