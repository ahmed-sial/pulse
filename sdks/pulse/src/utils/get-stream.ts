"use client";

import { isContext } from "node:vm";
import { useEffect, useRef, useState } from "react";

export type Filters = Record<string, string | number | boolean | undefined>;

export type LogLevel =
  | "info"
  | "warning"
  | "error"
  | "debug"
  | "success"
  | "audit"
  | "metric";

export type StreamLogNormalized = {
  id: string;
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
  payload: Record<string, unknown>;
};

type StreamLogRaw = {
  keyId: string;
  userId: string | null;
  type: string;
  message: string;
  appName: string;
  environment: string;
  importance: number | string | null;
  subsystem: string | null;
  operation: string | null;
  track: string | null;
  security: string | null;
  metrics: unknown;
  timestamp: string | number;
  ingested_at?: string | number;
};

export type GetStreamResult = {
  data: StreamLogNormalized[];
  isLoading: boolean;
  error: Error | null;
  connected: boolean;
  disconnect: () => void;
};

function toLogEntry(l: StreamLogRaw): StreamLogNormalized {
  const rawType = (l.type || "info").toLowerCase();

  const levelMap: Record<string, LogLevel> = {
    warning: "warning",
    success: "success",
    error: "error",
    debug: "debug",
    audit: "audit",
    metric: "metric",
  };

  const level: LogLevel = levelMap[rawType] || "info";

  let tsIso: string;
  if (typeof l.timestamp === "number") {
    tsIso = new Date(l.timestamp * 1000).toISOString();
  } else {
    tsIso = new Date(String(l.timestamp).replace(" ", "T") + "Z").toISOString();
  }

  return {
    id: crypto.randomUUID(),
    ts: tsIso,
    level,
    source: l.appName || "default",
    message: l.message,
    payload: { ...l },
  };
}

export function getStream(filters?: Filters): GetStreamResult {
  const [data, setData] = useState<StreamLogNormalized[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const qs =
      filters && Object.keys(filters).length > 0
        ? `?${new URLSearchParams(
            Object.entries(filters).reduce<Record<string, string>>(
              (acc, [k, v]) => {
                if (v !== undefined) acc[k] = String(v);
                return acc;
              },
              {},
            ),
          ).toString()}`
        : "";

    const es = new EventSource(`/api/pulse/stream${qs}`);
    esRef.current = es;
    setConnected(true);
    setIsLoading(true);
    setError(null);
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setData((prev) => {
          let incoming: StreamLogNormalized[] = [];
          if (payload && Array.isArray(payload.logs)) {
            incoming = payload.logs.map((l: StreamLogRaw) => toLogEntry(l));
          } else if (Array.isArray(payload)) {
            incoming = payload.map((l: StreamLogRaw) => toLogEntry(l));
          } else if (payload && payload.keyId) {
            incoming = [toLogEntry(payload as StreamLogRaw)];
          }
          if (payload?.type === "initial") {
            const next = incoming;
            setIsLoading(false);
            return next.length > 5000 ? next.slice(next.length - 5000) : next;
          }
          const next = [...prev, ...incoming];
          if (next.length > 5000) next.splice(0, next.length - 5000);
          setIsLoading(false);
          return next;
        });
      } catch (error: any) {
        console.error("PLS stream: failed to parse SSE message", error);
        setError(error);
        setIsLoading(false);
      }
    };
    es.onerror = (err: any) =>
      (es.onerror = (err: any) => {
        console.log("PLS stream: SSE error", err);
        setError(err instanceof Error ? err : new Error("SSE error"));
      });

    return () => {
      es.close();
      setConnected(false);
    };
  }, [JSON.stringify(filters || {})]);

  const disconnect = () => {
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  };

  return { data, isLoading, error, connected, disconnect };
}
