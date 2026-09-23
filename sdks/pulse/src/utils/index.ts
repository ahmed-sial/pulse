import { getEnvConfig } from "../configs/index.js";
import { LoggerConfig, LogPayload } from "../types/index.js";

export class PLSTransport {
  private baseUrl: string;
  private apiKey: string;
  private appName: string | undefined;
  private environment: string | undefined;
  private headers: Record<string, string>;
  private buffer: LogPayload[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushInterval = 2000;
  private shuttingDown = false;
  private isFlushing = false;

  constructor(private config: LoggerConfig) {
    const envConfig = getEnvConfig();
    this.baseUrl = envConfig.baseUrl;
    this.apiKey = config.apiKey;
    this.appName = config.appName;
    this.environment = config.environment;
    this.headers = {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      ...(config.appName ? { "x-pls-app-name": config.appName } : {}),
      ...(config.environment ? { "x-pls-env": config.environment } : {}),
    };
    this.setupGracefulShutdown();
  }

  async send(payload: LogPayload) {
    if (this.shuttingDown) return;
    this.buffer.push({ ...payload, ingested_at: Date.now() });
    if (!this.timer)
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
  }

  private setupGracefulShutdown() {
    const shutdownHandler = async (signal?: string) => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;
      try {
        await this.flush();
      } catch (err) {
        console.error("[PLSTransport] Flush during shutdown failed: ", err);
      } finally {
        process.exit(0);
      }
    };
    process.on("beforeExit", shutdownHandler);
    process.on("SIGINT", shutdownHandler);
    process.on("SIGTERM", shutdownHandler);
  }

  private async flush() {
    if (this.isFlushing) return;
    this.isFlushing = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.buffer.splice(0, this.buffer.length);
    if (batch.length === 0) {
      this.isFlushing = false;
      return;
    }
    try {
      await fetch(`${this.baseUrl}/logs/send`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ logs: batch }),
        keepalive: true,
      });
    } catch (err) {
      console.error("PLSTransport flush failed: ", err);
    }
    this.isFlushing = false;
  }
}
