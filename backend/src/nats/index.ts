import { connect, JSONCodec } from 'nats';
import dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
dotenv.config();

const jc = JSONCodec();
let natsConnection: any = null;

const logger = new Logger('NatsJetstreamClient', { timestamp: true });

export async function getNats() {
  if (!natsConnection) {
    natsConnection = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'pls-server',
    });
    logger.log('NatsJetstream connection successful');
  }
  return { nc: natsConnection, jc };
}
