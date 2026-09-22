export type LogLevel = "debug" | "info" | "warning" | "error" | "success";

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  requestId?: string;
  traceId?: string;
  user?: string;
  metadata: Record<string, unknown>;
};

export type Service = {
  name: string;
  status: "healthy" | "degraded" | "offline";
  environment: string;
  volume: string;
  errors: string;
  latency: string;
  color: string;
};

export type Theme = "dark" | "light";
