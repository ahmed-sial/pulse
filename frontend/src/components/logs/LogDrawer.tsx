import { useState } from "react";
import { Check, Copy, FileText, X } from "lucide-react";
import type { LogEntry } from "../../types";
import { levelStyle } from "../../constants/logLevels";
import { Detail } from "../common/Detail";

export function LogDrawer({
  log,
  close,
}: {
  log: LogEntry;
  close: () => void;
}) {
  const [copied, setCopied] = useState("");
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1200);
  };
  return (
    <div className="drawer-backdrop" onClick={close}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className={`level-pill ${levelStyle[log.level]}`}>
              {log.level}
            </span>
            <h2>Event details</h2>
          </div>
          <button className="icon-btn" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="drawer-actions">
          <button onClick={() => copy(JSON.stringify(log, null, 2), "json")}>
            <Copy size={14} /> {copied === "json" ? "Copied" : "Copy JSON"}
          </button>
          <button>
            <FileText size={14} /> Related logs
          </button>
        </div>
        <div className="detail-grid">
          <Detail
            label="Timestamp"
            value={new Date(log.timestamp).toLocaleString()}
          />
          <Detail label="Service" value={log.service} />
          <Detail label="Environment" value={log.environment} />
          <Detail label="Event ID" value={log.id} />
        </div>
        <div className="detail-block">
          <label>Message</label>
          <p className="message-box mono">{log.message}</p>
        </div>
        <div className="detail-block">
          <label>Identifiers</label>
          <div className="copy-row">
            <span>Request ID</span>
            <code>{log.requestId}</code>
            <button onClick={() => copy(log.requestId || "", "request")}>
              {copied === "request" ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <div className="copy-row">
            <span>Trace ID</span>
            <code>{log.traceId}</code>
            <button onClick={() => copy(log.traceId || "", "trace")}>
              {copied === "trace" ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <div className="detail-block">
          <label>Metadata</label>
          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
        </div>
      </aside>
    </div>
  );
}
