import { getNats } from './index.js';

export async function publishLogBatch(
  keyId: string,
  logs: any[],
  serverReceivedAt: number,
) {
  const { nc, jc } = await getNats();
  const js = nc.jetstream();

  await js.publish(
    'log.ingest',
    jc.encode({
      keyId,
      serverReceivedAt,
      timestamp: Date.now(),
      logs,
    }),
  );
}
