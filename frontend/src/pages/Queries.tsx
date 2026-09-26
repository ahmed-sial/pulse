import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Code2,
  History,
  Play,
  RefreshCw,
  Terminal,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHead } from "../components/common/PageHead";
import { ResizableY } from "../components/common/ResizableY";
import { LogDrawer } from "../components/logs/LogDrawer";
import { levelStyle } from "../constants/logLevels";
import { api } from "../api/axios";
import { useApi } from "../hooks/useApi";
import { useQueryHistory } from "../hooks/useQueryHistory";
import { parsePulseQL } from "../lib/pulseql";
import { normalizeLogRows } from "../lib/logs";
import { getApiErrorMessage } from "../lib/apiError";
import type { LogEntry } from "../types";

type QueryResult = {
  logs: LogEntry[];
  count: number;
  totalCount: number | null;
  cached: boolean;
  fallback: boolean;
  tookMs: number;
};

const DEFAULT_QUERY = "type:error appName:api";

export function Queries() {
  const { authRequest } = useApi();
  const { items: history, record, clear } = useQueryHistory();

  const [text, setText] = useState(DEFAULT_QUERY);
  const [chips, setChips] = useState<{ label: string; value: string }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [ran, setRan] = useState(false);

  const runQuery = useCallback(
    async (raw: string) => {
      const parsed = parsePulseQL(raw);
      setChips(parsed.chips);
      setWarnings(parsed.warnings);
      setLoading(true);
      setError(null);
      setRan(true);
      const start = performance.now();
      try {
        const response = await authRequest((token) =>
          api.get("/logs", {
            params: parsed.params,
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        const tookMs = Math.round(performance.now() - start);
        const data = response.data as {
          logs?: unknown[];
          count?: number;
          totalCount?: number;
          cached?: boolean;
          fallback?: boolean;
        };
        const normalized = normalizeLogRows((data.logs ?? []) as never);
        const count = data.count ?? normalized.length;
        setResult({
          logs: normalized,
          count,
          totalCount:
            typeof data.totalCount === "number" ? data.totalCount : null,
          cached: Boolean(data.cached),
          fallback: Boolean(data.fallback),
          tookMs,
        });
        record({ text: raw, count, tookMs });
      } catch (err) {
        setError(getApiErrorMessage(err));
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [authRequest, record],
  );

  // Preview the parsed filters as the user types, without hitting the API.
  useEffect(() => {
    const id = setTimeout(() => {
      const parsed = parsePulseQL(text);
      setChips(parsed.chips);
      setWarnings(parsed.warnings);
    }, 200);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <>
      <PageHead
        title="Query lab"
        description="Run focused searches across your Pulse event stream."
        action={
          <button
            className="btn primary"
            onClick={() => runQuery(text)}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw size={15} className="spinner" />
            ) : (
              <Play size={15} />
            )}{" "}
            Run query
          </button>
        }
      />
      <div className="query-layout">
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <section className="panel query-editor">
            <div className="editor-top">
              <span>
                <Terminal size={15} /> Query editor
              </span>
              <span className="muted">PulseQL</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runQuery(text);
                }
              }}
              spellCheck={false}
              wrap="off"
              placeholder="type:error env:production  or just plain text to search messages"
            />
            {chips.length > 0 && (
              <div className="query-chips">
                {chips.map((c) => (
                  <span className="query-chip" key={c.label}>
                    <b>{c.label}</b>
                    {c.value}
                  </span>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="query-warnings">
                {warnings.map((w) => (
                  <span key={w}>
                    <AlertTriangle
                      size={11}
                      style={{ marginRight: 5, verticalAlign: -1 }}
                    />
                    {w}
                  </span>
                ))}
              </div>
            )}
            <div className="query-footer">
              <span className="muted">
                Try{" "}
                <button onClick={() => setText("type:error env:production")}>
                  type:error env:production
                </button>{" "}
                or{" "}
                <button onClick={() => setText("appName:api timeout")}>
                  appName:api timeout
                </button>
              </span>
              <button className="btn secondary" onClick={() => setText("")}>
                Clear
              </button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent queries</h2>
                <span>Stored locally in this browser</span>
              </div>
              {history.length > 0 && (
                <button
                  className="icon-btn"
                  title="Clear history"
                  onClick={clear}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="empty-state small">
                <History size={20} />
                <b>No queries yet</b>
                <span>Queries you run will show up here.</span>
              </div>
            ) : (
              <div className="query-history">
                {history.map((item) => (
                  <button
                    key={item.id}
                    className="query-history-item"
                    onClick={() => {
                      setText(item.text);
                      runQuery(item.text);
                    }}
                  >
                    <code>{item.text || "(empty query)"}</code>
                    <span>
                      {item.count} · {item.tookMs}ms ·{" "}
                      {formatDistanceToNow(new Date(item.ranAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
        <section className="panel query-results">
          <div className="panel-head">
            <div>
              <h2>{ran ? "Query results" : "Recent query"}</h2>
              <span>
                {error
                  ? "The last request failed"
                  : ran
                    ? `${result?.count ?? 0} matching event${
                        result?.count === 1 ? "" : "s"
                      }${
                        result?.totalCount != null
                          ? ` · ${result.totalCount} total in last 24h`
                          : ""
                      }`
                    : "Run a query to inspect your telemetry"}
              </span>
            </div>
            {result && !error && (
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {result.cached && (
                  <span className="query-badge cached">
                    {result.fallback ? "stale cache" : "cached"}
                  </span>
                )}
                <span className="query-time">{result.tookMs}ms</span>
              </span>
            )}
          </div>
          {error ? (
            <div className="empty-state small">
              <AlertTriangle size={22} />
              <b>Query failed</b>
              <span>{error}</span>
              <button className="btn secondary" onClick={() => runQuery(text)}>
                Retry
              </button>
            </div>
          ) : ran ? (
            result && result.logs.length > 0 ? (
              <ResizableY
                className="query-results-scroll"
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
                    {result.logs.map((l) => (
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
              </ResizableY>
            ) : (
              <div className="empty-state small">
                <Code2 size={22} />
                <b>No matching events</b>
                <span>Try widening the range or removing a filter.</span>
              </div>
            )
          ) : (
            <div className="empty-state small">
              <Code2 size={22} />
              <b>Ready when you are</b>
              <span>Use the query editor to explore log data.</span>
            </div>
          )}
        </section>
      </div>
      {selected && <LogDrawer log={selected} close={() => setSelected(null)} />}
    </>
  );
}
