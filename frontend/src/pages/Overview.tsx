import {
  Activity,
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Gauge,
  ListFilter,
  RefreshCw,
  Server,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { PageHead } from "../components/common/PageHead";
import { Stat } from "../components/common/Stat";
import { RecentLogs } from "../components/logs/RecentLogs";
import { levelCounts, services } from "../data/mockData";

export function Overview() {
  return (
    <>
      <PageHead
        eyebrow="Workspace / production"
        title="System overview"
        description="A real-time view of your application telemetry and platform health."
        action={
          <button className="btn secondary">
            <RefreshCw size={15} /> Refresh data
          </button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Events ingested"
          value="82,419"
          change="18.6%"
          icon={Activity}
        />
        <Stat
          label="Error rate"
          value="1.84%"
          change="0.32%"
          icon={AlertTriangle}
          positive={false}
        />
        <Stat
          label="Active services"
          value="12 / 14"
          change="2 degraded"
          icon={Server}
          positive={false}
        />
        <Stat label="p95 latency" value="184 ms" change="12.4%" icon={Gauge} />
      </div>
      <div className="dashboard-grid">
        <section className="panel volume-panel">
          <div className="panel-head">
            <div>
              <h2>Event volume</h2>
              <span>
                Last 24 hours <i className="legend-dot" /> 82k events
              </span>
            </div>
            <button className="select-btn">
              24 hours <ChevronDown size={14} />
            </button>
          </div>
          <div className="chart-wrap">
            <div className="chart-y">
              <span>120k</span>
              <span>80k</span>
              <span>40k</span>
              <span>0</span>
            </div>
            <div className="area-chart">
              <div className="gridline" />
              <svg viewBox="0 0 600 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#71e5b2" stopOpacity=".3" />
                    <stop offset="1" stopColor="#71e5b2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 145 C45 118 70 138 100 112 S155 121 180 95 S220 116 250 82 S290 100 320 73 S365 102 400 62 S445 92 480 48 S530 72 600 24 V180 H0Z"
                  fill="url(#area)"
                />
                <path
                  d="M0 145 C45 118 70 138 100 112 S155 121 180 95 S220 116 250 82 S290 100 320 73 S365 102 400 62 S445 92 480 48 S530 72 600 24"
                  fill="none"
                  stroke="#71e5b2"
                  strokeWidth="2"
                />
              </svg>
              <div className="chart-x">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        </section>
        <section className="panel levels-panel">
          <div className="panel-head">
            <div>
              <h2>Log levels</h2>
              <span>Distribution by severity</span>
            </div>
            <ListFilter size={16} className="muted" />
          </div>
          <div className="donut-wrap">
            <div className="donut">
              <div>
                <b>82.4k</b>
                <span>total logs</span>
              </div>
            </div>
            <div className="level-list">
              {levelCounts.map((x) => (
                <div key={x.label}>
                  <i style={{ background: x.color }} />
                  <span>{x.label}</span>
                  <b>{x.value}%</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent activity</h2>
              <span>Latest events across your workspace</span>
            </div>
            <NavLink to="/logs" className="text-link">
              View explorer <ArrowUp size={14} />
            </NavLink>
          </div>
          <RecentLogs compact />
        </section>
        <section className="panel service-health">
          <div className="panel-head">
            <div>
              <h2>Service health</h2>
              <span>5 services with recent activity</span>
            </div>
            <NavLink to="/services" className="text-link">
              All services <ArrowUp size={14} />
            </NavLink>
          </div>
          {services.slice(0, 4).map((s) => (
            <div className="service-line" key={s.name}>
              <span className="service-dot" style={{ background: s.color }} />
              <b>{s.name}</b>
              <span className="service-latency">{s.latency}</span>
              <span className={`service-state ${s.status}`}>{s.status}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
