import { useState } from "react";
import { Check } from "lucide-react";
import { PageHead } from "../components/common/PageHead";

export function Settings() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageHead
        title="Settings"
        description="Workspace preferences, billing, and account controls."
      />
      <div className="settings-tabs">
        <button className="active">Workspace</button>
        <button>Billing & plan</button>
        <button>Account</button>
        <button>Danger zone</button>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Workspace details</h2>
          <p>Basic information about this Pulse workspace.</p>
          <label>
            Workspace name
            <input defaultValue="pulse-platform" />
          </label>
          <label>
            Default environment
            <select defaultValue="production">
              <option>production</option>
              <option>staging</option>
              <option>development</option>
            </select>
          </label>
          <button className="btn primary" onClick={() => setSaved(true)}>
            {saved ? (
              <>
                <Check size={15} /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </section>
        <section className="panel settings-card">
          <h2>Usage & plan</h2>
          <p>Your current event allowance and retention.</p>
          <div className="plan-card">
            <div>
              <span>Current plan</span>
              <b>Developer</b>
            </div>
            <span className="plan-badge">Active</span>
          </div>
          <div className="usage-large">
            <div>
              <span>Events this month</span>
              <b>680k / 1M</b>
            </div>
            <div className="usage-track">
              <i style={{ width: "68%" }} />
            </div>
            <small>Resets in 12 days</small>
          </div>
          <button className="btn secondary">Manage plan</button>
        </section>
      </div>
    </>
  );
}
