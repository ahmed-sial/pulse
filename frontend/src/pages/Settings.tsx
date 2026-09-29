import { useState } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
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
        <Link to="/billing">Billing & plan</Link>
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
          <h2>Billing & plan</h2>
          <p>View your current plan, usage, invoices, and subscription.</p>
          <Link className="btn secondary" to="/billing">
            Open billing
          </Link>
        </section>
      </div>
    </>
  );
}
