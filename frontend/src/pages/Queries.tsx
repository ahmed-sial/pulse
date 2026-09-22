import { useState } from "react";
import { Code2, Play, Terminal } from "lucide-react";
import { PageHead } from "../components/common/PageHead";
import { RecentLogs } from "../components/logs/RecentLogs";
import { logs } from "../data/mockData";

export function Queries() {
  const [query, setQuery] = useState("type:error AND appName:api");
  const [ran, setRan] = useState(false);
  return (
    <>
      <PageHead
        title="Query lab"
        description="Run focused searches across your Pulse event stream."
        action={
          <button className="btn primary" onClick={() => setRan(true)}>
            <Play size={15} /> Run query
          </button>
        }
      />
      <div className="query-layout">
        <section className="panel query-editor">
          <div className="editor-top">
            <span>
              <Terminal size={15} /> Query editor
            </span>
            <span className="muted">PulseQL</span>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
          <div className="query-footer">
            <span className="muted">
              Try{" "}
              <button onClick={() => setQuery("level:error service:payments")}>
                level:error service:payments
              </button>
            </span>
            <button className="btn secondary" onClick={() => setQuery("")}>
              Clear
            </button>
          </div>
        </section>
        <section className="panel query-results">
          <div className="panel-head">
            <div>
              <h2>{ran ? "Query results" : "Recent query"}</h2>
              <span>
                {ran
                  ? "5 matching events"
                  : "Run a query to inspect your telemetry"}
              </span>
            </div>
            <span className="query-time">18ms</span>
          </div>
          {ran ? (
            <RecentLogs
              rows={logs.filter((l) => l.level === "error").slice(0, 5)}
              onSelect={() => {}}
            />
          ) : (
            <div className="empty-state small">
              <Code2 size={22} />
              <b>Ready when you are</b>
              <span>Use the query editor to explore log data.</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
