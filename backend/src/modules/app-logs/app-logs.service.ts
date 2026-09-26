import { Injectable } from '@nestjs/common';
import { publishLogBatch } from '../../nats/producer.js';
import { Response } from 'express';
import { clickHouseClient } from '../../clickhouse/client.js';
import { addClient } from '../../sse/sse-registry.js';
import { LRUCache } from 'lru-cache';
import { QUERY_MAX_LIMIT } from '../../configs/index.js';

const queryCooldown = new LRUCache<string, number>({ max: 50_000 });
const resultCache = new LRUCache<
  string,
  { rows: any[]; totalCount: number; ts: number }
>({ max: 20_000 });

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

  private parseFilters(queryObj: any) {
    const filters: {
      limit?: number;
      type?: string;
      env?: string;
      appName?: string;
      search?: string;
      range?: string;
      from?: Number;
      to?: Number;
    } = {};

    const raw = queryObj.query as string | undefined;
    if (raw) {
      const parts = raw.split(/[&, \s]+/);
      for (const p of parts) {
        const [k, v] = p.split(':');
        if (!k || v == undefined) continue;
        const key = k.trim();
        const value = v.trim();
        if (key === 'type') filters.type = value;
        else if (key === 'env' || key === 'environment') filters.env = value;
        else if (key === 'app' || key === 'appName') filters.appName = value;
        else if (key === 'search') filters.search = value;
        else if (key === 'range') filters.range = value;
        else if (key === 'limit') filters.limit = Number(value);
        else if (key === 'from') filters.from = Number(value);
        else if (key === 'to') filters.to = Number(value);
      }
    }
    if (queryObj.type) filters.type = String(queryObj.type);
    if (queryObj.env) filters.env = String(queryObj.env);
    if (queryObj.appName) filters.appName = String(queryObj.appName);
    if (queryObj.search) filters.search = String(queryObj.search);
    if (queryObj.range) filters.range = String(queryObj.range);
    if (queryObj.limit) filters.limit = Number(queryObj.limit);
    if (queryObj.from) filters.from = Number(queryObj.from);
    if (queryObj.to) filters.to = Number(queryObj.to);
    return filters;
  }

  private buildCacheKey(userId: string, filters: any) {
    return `${userId}:${JSON.stringify(filters)}`;
  }

  private isCoolingDown(userId: string) {
    const now = Date.now();
    const last = queryCooldown.get(userId);
    if (last && now - last < 2000) return true;
    queryCooldown.set(userId, now);
    return false;
  }

  async getLogs(req: any, userId: string) {
    const parsed = this.parseFilters(req.query);
    let limit = parsed.limit ?? 100;
    if (limit > QUERY_MAX_LIMIT) limit = QUERY_MAX_LIMIT;
    if (limit < 1) limit = 1;

    let timestampFrom: number | undefined;
    let timestampTo: number | undefined;

    if (parsed.range) {
      const match = parsed.range.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = Number(match[1]);
        const unit = match[2];
        const nowSecs = Math.floor(Date.now() / 1000);
        const seconds = {
          s: value,
          m: value * 60,
          h: value * 3600,
          d: value * 86400,
        }[unit];

        timestampFrom = nowSecs - seconds!; // TODO: seconds might be undefined
        timestampTo = nowSecs;
      }
    }
    if (parsed.from) {
      const f = Number(parsed.from);
      timestampFrom = f > 2e12 ? Math.floor(f / 1000) : f;
    }
    if (parsed.to) {
      const f = Number(parsed.to);
      timestampTo = f > 2e12 ? Math.floor(f / 1000) : f;
    }
    if (!timestampFrom || !timestampTo) {
      const nowSecs = Math.floor(Date.now() / 1000);
      timestampTo = nowSecs;
      timestampFrom = nowSecs - 20 * 86400;
    }

    const { type, env, appName, search } = parsed;

    if (this.isCoolingDown(userId)) {
      const fallback = resultCache.get(this.buildCacheKey(userId, parsed));
      if (fallback) {
        return {
          fallback: true,
          cached: true,
          count: fallback.rows.length,
          totalCount: fallback.totalCount,
          logs: fallback.rows,
        };
      }
    }
    const filters = {
      limit,
      type,
      env,
      appName,
      search,
      timestampFrom,
      timestampTo,
    };
    const cachedKey = this.buildCacheKey(userId, filters);
    const cached = resultCache.get(cachedKey);

    if (cached && Date.now() - cached.ts < 1000) {
      return {
        fallback: false,
        cached: true,
        count: cached.rows.length,
        totalCount: cached.totalCount,
        logs: cached.rows,
      };
    }
    const where = [`userId = {userId:String}`];

    if (timestampFrom) where.push(`timestamp >= {from:UInt32}`);
    if (timestampTo) where.push(`timestamp <= {to:UInt32}`);

    if (type) where.push(`type = {type:String}`);
    if (env) where.push(`environment = {env:String}`);
    if (appName) where.push(`appName = {appName:String}`);
    if (search) where.push(`message ILIKE {search:String}`);

    const queryLogs = `
      SELECT *
      FROM logs.events
      WHERE ${where.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
    `;

    const nowSec = Math.floor(Date.now() / 1000);
    const from24h = nowSec - 24 * 60 * 60;
    const to24h = nowSec;

    const where24h = [
      'userId = {userId: String}',
      'timestamp >= {from24h: UInt32}',
      'timestamp <= {to24h: UInt32}',
    ];

    const queryCount = `
      SELECT count() AS total
      FROM logs.events
      WHERE ${where24h.join(' AND ')}
    `.trim();

    const [rsLogs, rsCount] = await Promise.all([
      clickHouseClient.query({
        query: queryLogs,
        format: 'JSONEachRow',
        query_params: {
          userId,
          type,
          env,
          appName,
          search,
          from: timestampFrom,
          to: timestampTo,
          limit,
        },
      }),
      clickHouseClient.query({
        query: queryCount,
        format: 'JSONEachRow',
        query_params: {
          userId,
          from24h,
          to24h,
        },
      }),
    ]);
    const rows = await rsLogs.json();
    const [{ total }] = (await rsCount.json()) as any;
    resultCache.set(cachedKey, {
      rows,
      totalCount: total,
      ts: Date.now(),
    });
    return {
      count: rows.length,
      totalCount: total,
      from: timestampFrom,
      to: timestampTo,
      logs: rows,
    };
  }
}
