import { Logger } from '@nestjs/common';
import { getNats } from './index.js';

const logger = new Logger('NatsJetstreamClient', { timestamp: true });

export async function initNatsStream() {
  const { nc } = await getNats();
  const jsm = await nc.jetstreamManager();

  try {
    await jsm.streams.info('PLS_LOGS');
    logger.log('PLS_LOGS stream already exists');
  } catch {
    await jsm.streams.add({
      name: 'PLS_LOGS',
      subjects: ['logs.ingest'],
      retention: 'workqueue',
      storage: 'file',
      max_age: 0,
      max_msgs: -1,
    });

    logger.log('PLS_LOGS stream created successfully');
  }
}
