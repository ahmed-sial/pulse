import type { LogEntry, LogLevel } from "../types";

/**
 * Shape of a row as it comes back from the backend, whether from
 * GET /logs (ClickHouse JSONEachRow) or a `logs.events` row pushed
 * over the /logs/stream SSE connection. Both paths produce the same
 * shape (see backend AppLogsService.getLogs / nats/consumer.ts).
 */
export interface RawLogRow {
  keyId: string;
  userId: string;
  type: string;
  message: string;
  appName: string;
  environment: string;
  importance: number | string | null;
  subsystem: string | null;
  service: string | null;
  operation: string | null;
  track: string | null;
  security: string | null;
  metrics: string | null;
  timestamp: string | number;
  ingested_at?: string | number;
}

const KNOWN_LEVELS: LogLevel[] = [
  "info",
  "warning",
  "error",
  "debug",
  "success",
  "audit",
  "metric",
];

function toLevel(rawType: string | undefined): LogLevel {
  const t = (rawType || "info").toLowerCase() as LogLevel;
  return KNOWN_LEVELS.includes(t) ? t : "info";
}

function toIso(value: string | number | undefined): string {
  if (value === undefined || value === null) return new Date().toISOString();
  if (typeof value === "number") {
    // ClickHouse UInt32 epoch seconds vs. JS ms epoch.
    const ms = value > 2e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  // ClickHouse DateTime string: "YYYY-MM-DD HH:MM:SS" (UTC).
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function safeParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

let seq = 0;
function nextId(row: RawLogRow) {
  seq += 1;
  return `${row.keyId || "log"}_${row.timestamp}_${seq}`;
}

/** Normalizes a raw ClickHouse-shaped log row into the dashboard's LogEntry. */
export function normalizeLogRow(row: RawLogRow): LogEntry {
  const track = safeParse<LogEntry["track"]>(row.track);
  const security = safeParse<LogEntry["security"]>(row.security);
  const metrics = safeParse<LogEntry["metrics"]>(row.metrics);
  const importance =
    row.importance === null || row.importance === undefined
      ? null
      : Number(row.importance);

  return {
    id: nextId(row),
    timestamp: toIso(row.timestamp),
    level: toLevel(row.type),
    service: row.appName || row.service || "unknown",
    appName: row.appName,
    environment: row.environment || "unknown",
    message: row.message,
    keyId: row.keyId,
    subsystem: row.subsystem,
    operation: row.operation,
    importance: Number.isNaN(importance as number) ? null : importance,
    track,
    security,
    metrics,
    ingestedAt: row.ingested_at ? toIso(row.ingested_at) : null,
    metadata: {
      ...(track ? { track } : {}),
      ...(security ? { security } : {}),
      ...(metrics ? { metrics } : {}),
    },
  };
}

export function normalizeLogRows(rows: RawLogRow[]): LogEntry[] {
  return rows.map(normalizeLogRow);
}

export type LogFilters = {
  type?: string;
  env?: string;
  appName?: string;
  search?: string;
  range?: string;
  limit?: number;
};

/** Builds a clean query-param object, dropping "all"/empty values. */
export function buildLogQueryParams(filters: LogFilters) {
  const params: Record<string, string | number> = {};
  if (filters.type && filters.type !== "all") params.type = filters.type;
  if (filters.env && filters.env !== "all") params.env = filters.env;
  if (filters.appName && filters.appName !== "all")
    params.appName = filters.appName;
  if (filters.search && filters.search.trim())
    params.search = filters.search.trim();
  if (filters.range) params.range = filters.range;
  if (filters.limit) params.limit = filters.limit;
  return params;
}

export const API_BASE_URL = "http://localhost:3000/api/v1";
