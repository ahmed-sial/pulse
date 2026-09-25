import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { API_BASE_URL } from "../lib/logs";
import type { RawLogRow } from "../lib/logs";

export type StreamEvent = { type: "initial" | "live"; logs: RawLogRow[] };

export type StreamFilters = {
  type?: string;
  env?: string;
  appName?: string;
  limit?: number;
};

/**
 * The GET /logs/stream endpoint sits behind Clerk auth, so it needs an
 * `Authorization` header — something the native `EventSource` API cannot
 * send. This reads the SSE response body manually with `fetch` instead.
 *
 * Note: the `search` filter is deliberately never sent to this endpoint.
 * The backend's live broadcast filter (`sse-registry.ts`) reads a
 * `log.messages` field that doesn't exist on log rows, which throws for
 * any connected client once a search filter is set. Search is applied
 * client-side on the received rows instead.
 */
export function useLogStream(enabled: boolean, filters: StreamFilters) {
  const { getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const onEventRef = useRef<((event: StreamEvent) => void) | null>(null);

  const setOnEvent = useCallback((cb: (event: StreamEvent) => void) => {
    onEventRef.current = cb;
  }, []);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      try {
        const token = await getToken();
        if (!token) throw new Error("You must be signed in to stream logs.");

        const qs = new URLSearchParams();
        const f = JSON.parse(filterKey) as StreamFilters;
        if (f.type && f.type !== "all") qs.set("type", f.type);
        if (f.env && f.env !== "all") qs.set("env", f.env);
        if (f.appName && f.appName !== "all") qs.set("appName", f.appName);
        if (f.limit) qs.set("limit", String(f.limit));

        const res = await fetch(
          `${API_BASE_URL}/logs/stream${qs.toString() ? `?${qs}` : ""}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok || !res.body) {
          throw new Error(`Failed to open log stream (${res.status})`);
        }

        setConnected(true);
        setError(null);
        retryDelay = 1000;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const dataLine = part
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(
                dataLine.slice(5).trim(),
              ) as StreamEvent;
              onEventRef.current?.(payload);
            } catch {
              // Ignore malformed frames rather than tearing down the stream.
            }
          }
        }
      } catch (err: any) {
        if (cancelled || err?.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("Stream error"));
      } finally {
        if (!cancelled) {
          setConnected(false);
          retryTimer = setTimeout(() => {
            if (!cancelled) connect();
          }, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 15000);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filterKey, getToken]);

  return { connected, error, setOnEvent };
}
