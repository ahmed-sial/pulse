import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  Command,
  LayoutDashboard,
  Search,
  Server,
  Settings as SettingsIcon,
} from "lucide-react";

export function CommandPalette({ close }: { close: () => void }) {
  const navg = useNavigate();
  const [q, setQ] = useState("");
  const actions = [
    ["Go to overview", "/"],
    ["Open live logs", "/logs"],
    ["View services", "/services"],
    ["Open alerts", "/alerts"],
    ["Open settings", "/settings"],
  ];
  const shown = actions.filter((a) =>
    a[0].toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="palette-backdrop" onClick={close}>
      <div className="palette panel" onClick={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <Search size={17} />
          <input
            autoFocus
            placeholder="Search Pulse"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd>ESC</kbd>
        </div>
        {shown.map(([label, to], i) => (
          <button
            key={to}
            onClick={() => {
              navg(to);
              close();
            }}
          >
            <span className="palette-icon">
              {i === 0 ? (
                <LayoutDashboard size={15} />
              ) : i === 1 ? (
                <Activity size={15} />
              ) : i === 2 ? (
                <Server size={15} />
              ) : i === 3 ? (
                <Bell size={15} />
              ) : (
                <SettingsIcon size={15} />
              )}
            </span>
            {label}
            <ArrowUp size={13} />
          </button>
        ))}
        <div className="palette-foot">
          <span>
            <Command size={12} /> Navigate
          </span>
          <span>
            <ArrowUp size={12} />
            <ArrowDown size={12} /> Select
          </span>
          <span>
            <span className="mono">↵</span> Open
          </span>
        </div>
      </div>
    </div>
  );
}
