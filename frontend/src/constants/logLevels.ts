export const levelStyle: Record<string, string> = {
  info: "level-info",
  success: "level-success",
  warning: "level-warning",
  error: "level-error",
  debug: "level-debug",
  audit: "level-audit",
  metric: "level-metric",
};

export const importanceLabel: Record<number, string> = {
  4: "Critical",
  3: "High",
  2: "Medium",
  1: "Low",
};

export const LOG_TYPES = [
  "error",
  "warning",
  "info",
  "success",
  "debug",
  "audit",
  "metric",
] as const;

export const LOG_RANGES: { value: string; label: string }[] = [
  { value: "15m", label: "Last 15 minutes" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];
