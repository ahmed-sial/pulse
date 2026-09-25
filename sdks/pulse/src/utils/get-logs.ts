"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Filters = Record<string, string | number | boolean | undefined>;

export type GetLogsResult<T = any> = {
  data: T[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const inflight = new Map<string, Promise<any>>();
const cache = new Map<string, any>();

function buildkey(params?: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) {
      sp.append(k, String(v));
    }
  });
  return sp.toString();
}

export function getLogs<T = any>(filters?: Filters): GetLogsResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const key = useMemo(() => buildkey(filters), [filters]);

  const fetchOnce = useCallback(async (k: string) => {
    if (cache.has(k)) return cache.get(k);
    let p = inflight.get(k);
    if (!p) {
      const url = `api/pulse/logs${k ? `?${k}` : ""}`;
      p = fetch(url, { cache: "no-store" }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch logs (${res.status}): ${text}`);
        }
        return res.json();
      });
      inflight.set(k, p);
    }
    try {
      const result = await p;
      cache.set(k, result);
      return result;
    } finally {
      inflight.delete(k);
    }
  }, []);
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const json = await fetchOnce(key);
      const rows = Array.isArray(json)
        ? (json as T[])
        : (json.logs ?? json ?? []);
      setData(rows ?? []);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setError(error);
        setData(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetchOnce]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const refetch = useCallback(async () => {
    cache.delete(key);
    await fetchLogs();
  }, []);

  return { data, isLoading, error, refetch };
}
