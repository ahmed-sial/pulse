import { getNats } from './index.js';

export async function publishLogBatch(
  keyId: string,
  userId: string,
  logs: any[],
  serverReceivedAt: number,
) {
  const { nc, jc } = await getNats();
  const js = nc.jetstream();

  await js.publish(
    'logs.ingest',
    jc.encode({
      keyId,
      userId,
      serverReceivedAt,
      timestamp: Date.now(),
      logs,
    }),
  );
}
