import type { LogEntry } from "../../types";
import { levelStyle } from "../../constants/logLevels";
import { logs } from "../../data/mockData";

export function RecentLogs({
  compact = false,
  rows = logs.slice(0, 6),
  onSelect,
}: {
  compact?: boolean;
  rows?: LogEntry[];
  onSelect?: (l: LogEntry) => void;
} = {}) {
  return (
    <div className={`recent-logs ${compact ? "compact" : ""}`}>
      {rows.map((l) => (
        <button className="recent-row" key={l.id} onClick={() => onSelect?.(l)}>
          <time>
            {new Date(l.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </time>
          <span className={`level-pill ${levelStyle[l.level]}`}>{l.level}</span>
          <b>{l.service}</b>
          <span className="log-message">{l.message}</span>
          <span className="row-env">{l.environment}</span>
        </button>
      ))}
    </div>
  );
}
