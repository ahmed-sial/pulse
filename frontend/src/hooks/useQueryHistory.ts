import { useCallback, useEffect, useState } from "react";

export type QueryHistoryItem = {
  id: string;
  text: string;
  ranAt: string;
  count: number;
  tookMs: number;
};

const STORAGE_KEY = "pulse.queryHistory";
const MAX_ITEMS = 20;

function load(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Query history is a client-only convenience — there's no backend
 * endpoint for saved/recent queries, so this lives in localStorage
 * and never leaves the browser.
 */
export function useQueryHistory() {
  const [items, setItems] = useState<QueryHistoryItem[]>([]);

  useEffect(() => {
    setItems(load());
  }, []);

  const record = useCallback(
    (entry: Omit<QueryHistoryItem, "id" | "ranAt">) => {
      setItems((prev) => {
        const deduped = prev.filter((p) => p.text !== entry.text);
        const next = [
          { ...entry, id: crypto.randomUUID(), ranAt: new Date().toISOString() },
          ...deduped,
        ].slice(0, MAX_ITEMS);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage full or unavailable — history just won't persist.
        }
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { items, record, clear };
}
