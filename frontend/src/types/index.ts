export type LogLevel =
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "success"
  | "audit"
  | "metric";

export type LogTrack = {
  user_id?: string;
  role?: string;
  ip?: string;
  user_agent?: string;
  geo?: string;
};

export type LogSecurity = {
  auth_status?: string;
  suspicious?: boolean;
  tags?: string[];
};

export type LogMetrics = {
  latency_ms?: number;
  db_query_count?: number;
};

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
  // Fields present on real (backend-sourced) log events. Optional so
  // existing mock-data consumers keep working untouched.
  keyId?: string;
  appName?: string;
  subsystem?: string | null;
  operation?: string | null;
  importance?: number | null;
  track?: LogTrack | null;
  security?: LogSecurity | null;
  metrics?: LogMetrics | null;
  ingestedAt?: string | null;
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
