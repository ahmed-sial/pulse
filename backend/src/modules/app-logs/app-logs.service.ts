import { Injectable } from '@nestjs/common';
import { publishLogBatch } from '../../nats/producer.js';
import { Response } from 'express';
import { clickHouseClient } from '../../clickhouse/client.js';
import { addClient } from '../../sse/sse-registry.js';

@Injectable()
export class AppLogsService {
  async sendLogs(keyId: any, userId: string, body: any) {
    await publishLogBatch(keyId, userId, body.logs, Date.now());
    return { message: 'OK' };
  }

  async startServerSentEvents(req: any, res: Response, userId: string) {
    const limit = Number(req.query.limit) || 500;
    const type = (req.query.type as string) || undefined;
    const env = (req.query.env as string) || undefined;
    const appName = (req.query.appName as string) || undefined;
    const search = (req.query.search as string) || undefined;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const conditions = ['userId = {userId:String}'];
    if (type) conditions.push('type = {type:String}');
    if (env) conditions.push('env = {env:String}');
    if (appName) conditions.push('appName = {appName:String}');
    if (search) conditions.push('search = {search:String}');

    const query = `
        SELECT *
        FROM logs.events
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
      `;

    const rs = await clickHouseClient.query({
      query,
      format: 'JSONEachRow',
      query_params: { userId, type, env, appName, search, limit },
    });

    const initialRows = await rs.json();

    res.write(
      `data: ${JSON.stringify({
        type: 'initial',
        logs: initialRows.reverse(),
      })}\n\n`,
    );

    addClient(res, { userId, appName, env, search, type });
    req.on('close', () => {
      res.send();
    });
  }
}
