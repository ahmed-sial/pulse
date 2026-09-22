import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  Filter,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { PageHead } from "../components/common/PageHead";
import { LogDrawer } from "../components/logs/LogDrawer";
import { levelStyle } from "../constants/logLevels";
import { logs, services } from "../data/mockData";
import type { LogEntry } from "../types";

export function Logs() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [service, setService] = useState("all");
  const [live, setLive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [newCount, setNewCount] = useState(0);
  useEffect(() => {
    if (!live || paused) return;
    const id = setInterval(() => setNewCount((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [live, paused]);
  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          (level === "all" || l.level === level) &&
          (service === "all" || l.service === service) &&
          (!query ||
            `${l.message} ${l.service} ${l.level}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [query, level, service],
  );
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
              onClick={() => setLive(!live)}
            >
              <i />
              {live ? "Live stream" : "Stream paused"}
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setPaused(!paused);
                setNewCount(0);
              }}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        }
      />
      <div className="logs-toolbar panel">
        <div className="log-search">
          <Search size={16} />
          <input
            aria-label="Search logs"
            placeholder="Search logs  e.g. service:api level:error"
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
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="debug">Debug</option>
        </select>
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="all">All services</option>
          {services.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="filter-btn">
          <Filter size={15} /> Filters <span>0</span>
        </button>
        <button className="icon-btn">
          <MoreHorizontal size={17} />
        </button>
      </div>
      {newCount > 0 && (
        <button className="new-events" onClick={() => setNewCount(0)}>
          <ArrowUp size={14} /> {newCount} new events — jump to latest
        </button>
      )}
      <div className="log-meta">
        <span>
          <b>{filtered.length}</b> events found
        </span>
        <span className="live-context">
          <i />
          Streaming from <b>12 services</b> <span>•</span> Updated just now
        </span>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll scrollbar">
          <table className="log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Service</th>
                <th>Message</th>
                <th>Environment</th>
                <th>Request ID</th>
                <th></th>
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
                  <td className="mono service-cell">{l.service}</td>
                  <td className="mono message-cell">{l.message}</td>
                  <td>
                    <span className="env-tag">{l.environment}</span>
                  </td>
                  <td className="mono muted request-cell">{l.requestId}</td>
                  <td>
                    <MoreHorizontal size={15} className="muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              <Search size={22} />
              <b>No matching logs</b>
              <span>Try a different search or reset your filters.</span>
              <button
                className="btn secondary"
                onClick={() => {
                  setQuery("");
                  setLevel("all");
                  setService("all");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>
      {selected && <LogDrawer log={selected} close={() => setSelected(null)} />}
    </>
  );
}
