import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Filter,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHead } from "../components/common/PageHead";
import { ResizableY } from "../components/common/ResizableY";
import { LogDrawer } from "../components/logs/LogDrawer";
import { levelStyle, LOG_RANGES, LOG_TYPES } from "../constants/logLevels";
import { api } from "../api/axios";
import { useApi } from "../hooks/useApi";
import { useLogStream } from "../hooks/useLogStream";
import { buildLogQueryParams, normalizeLogRows } from "../lib/logs";
import { getApiErrorMessage } from "../lib/apiError";
import type { LogEntry } from "../types";

const PAGE_SIZE = 100;
const MAX_LIMIT = 500;
const MAX_BUFFERED_ROWS = 2000;

export function Logs() {
  const { authRequest } = useApi();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [service, setService] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const [range, setRange] = useState("24h");
  const [live, setLive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);

  const [rows, setRows] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [totalCount24h, setTotalCount24h] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  // ---------- Historical fetch (GET /logs) — used whenever live is off ----------
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = buildLogQueryParams({
        type: level,
        env: environment,
        appName: service,
        search: debouncedQuery,
        range,
        limit,
      });
      const response = await authRequest((token) =>
        api.get("/logs", {
          params,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const data = response.data as {
        logs?: unknown[];
        totalCount?: number;
      };
      setRows(normalizeLogRows((data.logs ?? []) as never));
      setTotalCount24h(
        typeof data.totalCount === "number" ? data.totalCount : null,
      );
      setLastUpdated(new Date());
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [authRequest, level, environment, service, debouncedQuery, range, limit]);

  useEffect(() => {
    if (live) return;
    fetchLogs();
  }, [live, fetchLogs]);

  // ---------- Live stream (GET /logs/stream, SSE) — used whenever live is on ----------
  const streamFilters = useMemo(
    () => ({
      type: level,
      env: environment,
      appName: service,
      limit: MAX_LIMIT,
    }),
    [level, environment, service],
  );

  useEffect(() => {
    if (!live) return;
    setLoading(true);
    setLoadError(null);
    setRows([]);
    setPending([]);
  }, [live, streamFilters]);

  const { connected, error: streamError, setOnEvent } = useLogStream(
    live,
    streamFilters,
  );

  useEffect(() => {
    setOnEvent((event) => {
      const normalized = normalizeLogRows(event.logs as never);
      setLastUpdated(new Date());
      if (event.type === "initial") {
        // Backend sends the initial batch oldest -> newest.
        setRows(normalized.slice().reverse());
        setLoading(false);
        return;
      }
      // Live batches already arrive newest-first.
      if (paused) {
        setPending((prev) => [...normalized, ...prev]);
      } else {
        setRows((prev) =>
          [...normalized, ...prev].slice(0, MAX_BUFFERED_ROWS),
        );
      }
    });
  }, [setOnEvent, paused]);

  const knownServices = useMemo(() => {
    const set = new Set<string>();
    [...pending, ...rows].forEach((l) => set.add(l.appName ?? l.service));
    return Array.from(set).sort();
  }, [rows, pending]);

  const knownEnvironments = useMemo(() => {
    const set = new Set<string>();
    [...pending, ...rows].forEach((l) => set.add(l.environment));
    return Array.from(set).sort();
  }, [rows, pending]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return rows.filter((l) => {
      if (level !== "all" && l.level !== level) return false;
      if (environment !== "all" && l.environment !== environment)
        return false;
      if (service !== "all" && (l.appName ?? l.service) !== service)
        return false;
      if (
        q &&
        !`${l.message} ${l.service} ${l.level} ${l.operation ?? ""} ${
          l.subsystem ?? ""
        }`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [rows, level, environment, service, debouncedQuery]);

  const activeFilterCount = [
    level !== "all",
    environment !== "all",
    service !== "all",
    debouncedQuery.length > 0,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setQuery("");
    setLevel("all");
    setService("all");
    setEnvironment("all");
  };

  const jumpToLatest = () => {
    setRows((prev) => [...pending, ...prev].slice(0, MAX_BUFFERED_ROWS));
    setPending([]);
  };

  const canLoadMore = !live && !loading && limit < MAX_LIMIT;

  return (
    <>
      <PageHead
        eyebrow="Monitor / stream"
        title="Live log explorer"
        description="Search, filter, and inspect events flowing through your services."
        action={
          <div className="live-actions">
            <button
              className={`live-toggle ${live ? "on" : ""}`}
              onClick={() => {
                setPending([]);
                setPaused(false);
                setLive(!live);
              }}
            >
              <i />
              {live ? "Live stream" : "Stream paused"}
            </button>
            {live ? (
              <button
                className="btn secondary"
                onClick={() => {
                  if (paused) jumpToLatest();
                  setPaused(!paused);
                }}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}{" "}
                {paused ? "Resume" : "Pause"}
              </button>
            ) : (
              <button
                className="btn secondary"
                onClick={fetchLogs}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? "spinner" : ""} />{" "}
                Refresh
              </button>
            )}
          </div>
        }
      />
      <div className="logs-toolbar panel">
        <div className="log-search">
          <Search size={16} />
          <input
            aria-label="Search logs"
            placeholder="Search logs  e.g. checkout timed out"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
          <kbd>/</kbd>
        </div>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">All levels</option>
          {LOG_TYPES.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="all">All services</option>
          {knownServices.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
        >
          <option value="all">All environments</option>
          {knownEnvironments.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          value={live ? "" : range}
          onChange={(e) => {
            setRange(e.target.value);
            setLive(false);
          }}
        >
          {live && <option value="">Live (choose a range to pause)</option>}
          {LOG_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          className="filter-btn"
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
          title="Clear all filters"
        >
          <Filter size={15} /> Filters <span>{activeFilterCount}</span>
        </button>
      </div>
      {pending.length > 0 && (
        <button className="new-events" onClick={jumpToLatest}>
          <ArrowUp size={14} /> {pending.length} new event
          {pending.length === 1 ? "" : "s"} — jump to latest
        </button>
      )}
      {(loadError || streamError) && (
        <button
          className="new-events"
          style={{
            borderColor: "#7a2b33",
            background: "#3a1518",
            color: "#ff7c89",
          }}
          onClick={live ? undefined : fetchLogs}
        >
          <AlertTriangle size={14} />{" "}
          {loadError ?? streamError?.message ?? "Something went wrong"}
          {!live && " — click to retry"}
        </button>
      )}
      <div className="log-meta">
        <span>
          <b>{filtered.length}</b> events{" "}
          {live
            ? "streaming"
            : `loaded${
                totalCount24h != null
                  ? ` · ~${totalCount24h} in last 24h`
                  : ""
              }`}
        </span>
        <span className="live-context">
          <i
            style={{
              background: live
                ? connected
                  ? "var(--accent)"
                  : "#f4b86a"
                : "#6f8294",
            }}
          />
          {live
            ? connected
              ? "Connected"
              : "Reconnecting…"
            : "Historical view"}
          <span>•</span>
          {lastUpdated
            ? `Updated ${formatDistanceToNow(lastUpdated, {
                addSuffix: true,
              })}`
            : loading
              ? "Loading…"
              : "Not loaded yet"}
        </span>
      </div>
      <div className="panel table-panel">
        <ResizableY
          className="logs-scroll"
          contentClassName="table-scroll scrollbar"
          handleTitle="Drag to resize"
        >
          <table className="log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Service</th>
                <th>Message</th>
                <th>Environment</th>
                <th>Operation</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} onClick={() => setSelected(l)}>
                  <td className="mono time">
                    {new Date(l.timestamp).toLocaleTimeString([], {
                      hour12: false,
                    })}
                  </td>
                  <td>
                    <span className={`level-pill ${levelStyle[l.level]}`}>
                      {l.level}
                    </span>
                  </td>
                  <td className="mono service-cell">
                    {l.appName ?? l.service}
                  </td>
                  <td className="mono message-cell">{l.message}</td>
                  <td>
                    <span className="env-tag">{l.environment}</span>
                  </td>
                  <td className="mono muted request-cell">
                    {l.operation ?? l.subsystem ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              <Search size={22} />
              <b>No matching logs</b>
              <span>
                {rows.length === 0
                  ? "No events have arrived yet for this filter."
                  : "Try a different search or reset your filters."}
              </span>
              {activeFilterCount > 0 && (
                <button className="btn secondary" onClick={resetFilters}>
                  Reset filters
                </button>
              )}
            </div>
          )}
        </ResizableY>
        {canLoadMore && rows.length >= limit && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "12px",
            }}
          >
            <button
              className="btn secondary"
              onClick={() =>
                setLimit((l) => Math.min(l + PAGE_SIZE, MAX_LIMIT))
              }
              disabled={loading}
            >
              Load more
            </button>
          </div>
        )}
      </div>
      {selected && (
        <LogDrawer log={selected} close={() => setSelected(null)} />
      )}
    </>
  );
}
