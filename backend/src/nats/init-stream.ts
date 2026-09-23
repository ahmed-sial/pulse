import { Logger } from '@nestjs/common';
import { getNats } from './index.js';

const logger = new Logger('NatsJetstreamClient', { timestamp: true });

export async function initNatsStream() {
  const { nc } = await getNats();
  const jsm = await nc.jetstreamManager();
  await jsm.streams.add({
    name: 'PLS_LOGS',
    subject: ['logs.ingest'],
    retention: 'workqueue',
    storage: 'file',
    max_age: 0,
    max_msgs: -1,
  });
  logger.log('NatsJetstream stream PLS_LOGS initialized successfully');
}

// TODO: Understand this file, also understand the working of producer and consumer
