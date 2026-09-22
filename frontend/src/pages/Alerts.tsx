import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { PageHead } from "../components/common/PageHead";
import { Modal } from "../components/common/Modal";

export function Alerts() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead
        title="Alerts"
        description="Route important signals to the people who can act on them."
        action={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New alert
          </button>
        }
      />
      <div className="empty-panel panel">
        <div className="empty-icon">
          <Bell size={22} />
        </div>
        <h2>No alerts configured</h2>
        <p>
          Create your first alert to get notified when your system needs
          attention.
        </p>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Plus size={15} /> Create an alert
        </button>
      </div>
      {open && (
        <Modal close={() => setOpen(false)} title="Create alert">
          <label>
            Alert name
            <input placeholder="Payments error spike" />
          </label>
          <label>
            Condition
            <input placeholder="error_rate > 5% for 5 minutes" />
          </label>
          <div className="modal-row">
            <label>
              Severity
              <select>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <label>
              Channel
              <select>
                <option>Slack</option>
                <option>Email</option>
                <option>Webhook</option>
              </select>
            </label>
          </div>
          <div className="modal-footer">
            <button className="btn secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={() => setOpen(false)}>
              Save alert
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
