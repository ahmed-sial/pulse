import { Injectable } from '@nestjs/common';
import { publishLogBatch } from '../../nats/producer.js';

@Injectable()
export class AppLogsService {
  async sendLogs(body: any, keyId: any) {
    await publishLogBatch(keyId, body.logs, Date.now());
    return { message: 'OK' };
  }
}
