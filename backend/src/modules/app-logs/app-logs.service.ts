import { Injectable } from '@nestjs/common';
import { publishLogBatch } from '../../nats/producer.js';

@Injectable()
export class AppLogsService {
  async sendLogs(keyId: any, userId: string, body: any) {
    await publishLogBatch(keyId, userId, body.logs, Date.now());
    return { message: 'OK' };
  }
}
