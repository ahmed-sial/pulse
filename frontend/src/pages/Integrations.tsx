import { Activity, Code2, Globe2, Terminal, Zap } from "lucide-react";
import { PageHead } from "../components/common/PageHead";

export function Integrations() {
  const items = [
    ["Next.js", "React framework", "Connected", Code2],
    ["Express.js", "Node.js web framework", "Connected", Zap],
    ["NestJS", "Progressive Node framework", "Coming soon", Code2],
    ["Django", "Python web framework", "Coming soon", Globe2],
    ["Flask", "Lightweight Python", "Coming soon", Terminal],
    ["OpenTelemetry", "Vendor-neutral telemetry", "Connect", Activity],
  ] as const;
  return (
    <>
      <PageHead
        title="Integrations"
        description="Connect Pulse to the tools and frameworks in your stack."
      />
      <div className="integration-grid">
        {items.map(([name, desc, status, Icon]) => (
          <div
            className={`integration panel ${status === "Coming soon" ? "disabled" : ""}`}
            key={name}
          >
            <div className="integration-icon">
              <Icon size={21} />
            </div>
            <div>
              <h3>{name}</h3>
              <p>{desc}</p>
            </div>
            <span className={status === "Connected" ? "connected" : ""}>
              {status}
            </span>
            {status !== "Coming soon" && (
              <button className="btn secondary">
                {status === "Connected" ? "View docs" : "Connect"}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
