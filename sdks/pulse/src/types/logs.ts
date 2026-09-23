import { Importance, LogType, Subsystem } from "./index.js";
import { LogMetrics } from "./metrics.js";
import { LogSecurity } from "./security.js";
import { LogTrack } from "./track.js";

export interface LogTimestamps {
  event_time: string;
  ingest_time?: string;
}

export interface LogMessage {
  type: LogType;
  message: string;
  importance: Importance;
  subsystem: Subsystem;
  operation?: string;
  track: LogTrack;
  security: LogSecurity;
  metrics: LogMetrics;
  timestamps: LogTimestamps;
}
