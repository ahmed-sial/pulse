import { Plus } from "lucide-react";
import { PageHead } from "../components/common/PageHead";
import { MiniChart } from "../components/common/MiniChart";
import { services, volume } from "../data/mockData";

export function Services() {
  return (
    <>
      <PageHead
        title="Services"
        description="Health and activity across the services sending data to Pulse."
        action={
          <button className="btn primary">
            <Plus size={15} /> Add service
          </button>
        }
      />
      <div className="service-summary">
        <div>
          <span>Healthy</span>
          <b>11</b>
        </div>
        <div>
          <span>Degraded</span>
          <b className="amber">2</b>
        </div>
        <div>
          <span>Offline</span>
          <b>1</b>
        </div>
        <div>
          <span>Total volume</span>
          <b>
            82.4k <small>24h</small>
          </b>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table className="service-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Environment</th>
                <th>24h volume</th>
                <th>Error rate</th>
                <th>p95 latency</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name}>
                  <td>
                    <span
                      className="service-dot"
                      style={{ background: s.color }}
                    />
                    <b>{s.name}</b>
                  </td>
                  <td>
                    <span className={`service-state ${s.status}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <span className="env-tag">{s.environment}</span>
                  </td>
                  <td className="mono">{s.volume}</td>
                  <td className={s.status === "degraded" ? "error-text" : ""}>
                    {s.errors}
                  </td>
                  <td className="mono">{s.latency}</td>
                  <td>
                    <MiniChart
                      data={volume
                        .slice(0, 12)
                        .map(
                          (v, i) => v - (s.status === "degraded" ? i * 3 : 0),
                        )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
