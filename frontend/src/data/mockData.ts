import type { LogEntry, Service } from "../types";

export const services: Service[] = [
  {
    name: "api-gateway",
    status: "healthy",
    environment: "production",
    volume: "42.8k",
    errors: "0.8%",
    latency: "86ms",
    color: "#72e5b1",
  },
  {
    name: "identity",
    status: "healthy",
    environment: "production",
    volume: "18.4k",
    errors: "0.2%",
    latency: "42ms",
    color: "#8bb7ff",
  },
  {
    name: "payments",
    status: "degraded",
    environment: "production",
    volume: "9.7k",
    errors: "3.4%",
    latency: "284ms",
    color: "#f4b86a",
  },
  {
    name: "queue-worker",
    status: "healthy",
    environment: "staging",
    volume: "7.2k",
    errors: "0.0%",
    latency: "118ms",
    color: "#b09cff",
  },
  {
    name: "notifications",
    status: "healthy",
    environment: "production",
    volume: "4.1k",
    errors: "0.4%",
    latency: "61ms",
    color: "#65d2df",
  },
];
const messages = [
  ["info", "api-gateway", "GET /v1/projects completed in 86ms"],
  ["success", "identity", "Session refreshed for user usr_8f2a"],
  ["warning", "payments", "Provider latency above 250ms threshold"],
  ["error", "api-gateway", "Database connection pool exhausted"],
  ["info", "queue-worker", "Job invoice.sync completed successfully"],
  ["debug", "notifications", "Dispatch batch prepared with 42 recipients"],
  ["error", "payments", "Webhook signature validation failed"],
  ["info", "identity", "OAuth token rotated for workspace acme"],
  ["success", "api-gateway", "Deployment health check passed"],
  ["warning", "queue-worker", "Retry queue depth reached 68 items"],
] as const;
export const logs: LogEntry[] = Array.from({ length: 32 }, (_, i) => {
  const [level, service, message] = messages[i % messages.length];
  const ts = new Date(Date.now() - i * 47_000).toISOString();
  return {
    id: `evt_${String(9300 - i).padStart(4, "0")}`,
    timestamp: ts,
    level,
    service,
    environment: service === "queue-worker" ? "staging" : "production",
    message,
    requestId: `req_${Math.random().toString(36).slice(2, 10)}`,
    traceId: `tr_${Math.random().toString(36).slice(2, 14)}`,
    user: i % 3 === 0 ? "olivia@pulse.dev" : undefined,
    metadata: {
      region: i % 2 ? "iad1" : "fra1",
      status: i % 4 === 3 ? 500 : 200,
      duration: `${42 + i * 7}ms`,
      attempt: (i % 3) + 1,
    },
  };
});
export const volume = [
  34, 42, 38, 51, 48, 56, 63, 59, 71, 68, 76, 83, 78, 91, 88, 96, 102, 94, 110,
  106, 118, 112, 124, 116,
];
export const levelCounts = [
  { label: "Info", value: 68, color: "#8bb7ff" },
  { label: "Success", value: 18, color: "#72e5b1" },
  { label: "Warning", value: 9, color: "#f4b86a" },
  { label: "Error", value: 5, color: "#ff7c89" },
];
