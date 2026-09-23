import { consumerOpts } from 'nats';
import { getNats } from './index.js';

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
}
