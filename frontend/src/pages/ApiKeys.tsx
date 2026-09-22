import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader, Plus, TrashIcon } from "lucide-react";
import { PageHead } from "../components/common/PageHead";
import { Modal } from "../components/common/Modal";
import { api } from "../api/axios";
import { toast } from "sonner";
import { getApiErrorMessage } from "../lib/apiError";
import { useApi } from "../hooks/useApi";
import { formatDistanceToNow } from "date-fns";

export interface IApiKey {
  id: string;
  apiName: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  apiKey?: string;
}

function relativeTime(value: string | null) {
  return value
    ? formatDistanceToNow(new Date(value), { addSuffix: true })
    : null;
}

export function ApiKeys() {
  const [keys, setKeys] = useState<IApiKey[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(true);
  const [revealedKey, setRevealedKey] = useState<IApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<IApiKey | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { authRequest } = useApi();

  useEffect(() => {
    let cancelled = false;
    const getApiKeys = async () => {
      try {
        const response = await authRequest((token) =>
          api.get("/apikeys", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        if (!cancelled) setKeys(response.data["apiKeys"] ?? []);
      } catch (err) {
        if (!cancelled) toast.error(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    };
    getApiKeys();
    return () => {
      cancelled = true;
    };
  }, [authRequest]);

  const handleGenerateApiKey = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a key name");
      return;
    }
    const payload = { apiKeyProps: { name: trimmedName } };
    try {
      setLoading(true);
      const response = await authRequest((token) =>
        api.post<IApiKey>("/apikeys/create", payload, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const created = response.data;
      setKeys((prev) => [created, ...prev]);
      setName("");
      setOpen(false);
      setRevealedKey(created);
      toast.success("API key generated");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!revealedKey?.apiKey) return;
    navigator.clipboard.writeText(revealedKey.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleConfirmRevoke = async () => {
    if (!confirmRevoke) return;
    const { id } = confirmRevoke;
    const prevKeys = keys;
    setRevokingId(id);
    const revokedAt = new Date().toISOString();
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt } : k)));
    setConfirmRevoke(null);
    try {
      await authRequest((token) =>
        api.delete(`/apikeys/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      toast.success("API key revoked");
    } catch (err) {
      setKeys(prevKeys);
      toast.error(getApiErrorMessage(err));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <>
      <PageHead
        title="API keys"
        description="Manage credentials used to send telemetry to Pulse."
        action={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> Generate key
          </button>
        }
      />
      <div className="key-notice panel">
        <KeyRound size={18} />
        <div>
          <b>Keep your keys secure</b>
          <span>
            Use environment variables and rotate credentials regularly. Keys are
            only shown once.
          </span>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-title">
          <h2>Project keys</h2>
          <span>{keys.filter((k) => !k.revokedAt).length} active keys</span>
        </div>
        {apiLoading ? (
          <div className="loader-container">
            <Loader className="spinner" />
          </div>
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <KeyRound size={22} />
            <b>No API keys yet</b>
            <span>Generate a key to start sending events to Pulse.</span>
            <button className="btn secondary" onClick={() => setOpen(true)}>
              Generate first key
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="key-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <KeyRound size={14} className="muted" />{" "}
                      <b>{k.apiName}</b>
                    </td>
                    <td className="mono muted">{k.prefix}</td>
                    <td>{relativeTime(k.createdAt) ?? "just now"}</td>
                    <td>{relativeTime(k.lastUsedAt) ?? "Never"}</td>
                    <td>
                      <span
                        className={`service-state ${k.revokedAt ? "offline" : "healthy"}`}
                      >
                        {k.revokedAt ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td>
                      {!k.revokedAt && (
                        <button
                          className="icon-btn"
                          onClick={() => setConfirmRevoke(k)}
                          disabled={revokingId === k.id}
                          aria-label="Revoke key"
                        >
                          <TrashIcon size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <Modal close={() => setOpen(false)} title="Generate API key">
          <label>
            Key name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production ingest"
            />
          </label>
          <div className="modal-footer">
            <button className="btn secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={handleGenerateApiKey}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate key"}
            </button>
          </div>
        </Modal>
      )}
      {revealedKey && (
        <Modal close={() => setRevealedKey(null)} title="Copy your new key">
          <p>
            This is the only time <b>{revealedKey.apiName}</b>'s secret will be
            shown. Store it somewhere safe.
          </p>
          <div className="copy-row">
            <code className="mono">{revealedKey.apiKey}</code>
            <button className="icon-btn" onClick={handleCopySecret}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <div className="modal-footer">
            <button
              className="btn primary"
              onClick={() => setRevealedKey(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
      {confirmRevoke && (
        <Modal close={() => setConfirmRevoke(null)} title="Revoke API key?">
          <p>
            <b>{confirmRevoke.apiName}</b> will stop working immediately.
            Anything using this key will start failing until it's replaced with
            a new one. This can't be undone.
          </p>
          <div className="modal-footer">
            <button
              className="btn secondary"
              onClick={() => setConfirmRevoke(null)}
            >
              Cancel
            </button>
            <button className="btn danger" onClick={handleConfirmRevoke}>
              Revoke key
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
