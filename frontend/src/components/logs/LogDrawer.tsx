import { useState } from "react";
import { Check, Copy, ShieldAlert, X } from "lucide-react";
import type { LogEntry } from "../../types";
import { importanceLabel, levelStyle } from "../../constants/logLevels";
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

  const track = log.track ?? undefined;
  const security = log.security ?? undefined;
  const metrics = log.metrics ?? undefined;
  const hasIdentifiers = Boolean(
    log.keyId || track?.user_id || track?.ip || track?.geo,
  );

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
        </div>
        <div className="detail-grid">
          <Detail
            label="Timestamp"
            value={new Date(log.timestamp).toLocaleString()}
          />
          <Detail label="Service" value={log.appName ?? log.service} />
          <Detail label="Environment" value={log.environment} />
          {log.subsystem && <Detail label="Subsystem" value={log.subsystem} />}
          {log.operation && <Detail label="Operation" value={log.operation} />}
          {log.importance != null && (
            <Detail
              label="Importance"
              value={importanceLabel[log.importance] ?? String(log.importance)}
            />
          )}
        </div>
        <div className="detail-block">
          <label>Message</label>
          <p className="message-box mono">{log.message}</p>
        </div>
        {hasIdentifiers && (
          <div className="detail-block">
            <label>Identifiers</label>
            {log.keyId && (
              <div className="copy-row">
                <span>API key ID</span>
                <code>{log.keyId}</code>
                <button onClick={() => copy(log.keyId || "", "keyId")}>
                  {copied === "keyId" ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            )}
            {track?.user_id && (
              <div className="copy-row">
                <span>User ID</span>
                <code>{track.user_id}</code>
                <button onClick={() => copy(track.user_id || "", "user_id")}>
                  {copied === "user_id" ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            )}
            {track?.ip && (
              <div className="copy-row">
                <span>IP address</span>
                <code>{track.ip}</code>
                <button onClick={() => copy(track.ip || "", "ip")}>
                  {copied === "ip" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            )}
            {track?.geo && (
              <div className="copy-row">
                <span>Location</span>
                <code>{track.geo}</code>
                <button onClick={() => copy(track.geo || "", "geo")}>
                  {copied === "geo" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            )}
            {track?.role && (
              <div className="copy-row">
                <span>Role</span>
                <code>{track.role}</code>
                <button onClick={() => copy(track.role || "", "role")}>
                  {copied === "role" ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            )}
            {track?.user_agent && (
              <div className="copy-row">
                <span>User agent</span>
                <code>{track.user_agent}</code>
                <button
                  onClick={() => copy(track.user_agent || "", "user_agent")}
                >
                  {copied === "user_agent" ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {security && (security.auth_status || security.suspicious || security.tags?.length) && (
          <div className="detail-block">
            <label>Security</label>
            <div className="detail-grid">
              {security.auth_status && (
                <Detail label="Auth status" value={security.auth_status} />
              )}
              {security.suspicious !== undefined && (
                <Detail
                  label="Suspicious"
                  value={security.suspicious ? "Yes" : "No"}
                />
              )}
            </div>
            {security.suspicious && (
              <p className="message-box mono" style={{ color: "#ff7c89" }}>
                <ShieldAlert size={13} style={{ marginRight: 6 }} />
                This event was flagged as suspicious.
              </p>
            )}
            {security.tags && security.tags.length > 0 && (
              <div className="copy-row">
                <span>Tags</span>
                <code>{security.tags.join(", ")}</code>
              </div>
            )}
          </div>
        )}
        {metrics && (metrics.latency_ms != null || metrics.db_query_count != null) && (
          <div className="detail-block">
            <label>Metrics</label>
            <div className="detail-grid">
              {metrics.latency_ms != null && (
                <Detail label="Latency" value={`${metrics.latency_ms} ms`} />
              )}
              {metrics.db_query_count != null && (
                <Detail
                  label="DB queries"
                  value={String(metrics.db_query_count)}
                />
              )}
            </div>
          </div>
        )}
        <div className="detail-block">
          <label>Raw payload</label>
          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
        </div>
      </aside>
    </div>
  );
}
