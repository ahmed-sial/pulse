import { LoggerConfig, LogPayload, LogType } from "../types/index.js";
import { PLSTransport } from "../utils/index.js";

export function createLogger(config: LoggerConfig) {
  const transport = new PLSTransport(config);
  const send = async (payload: LogPayload) => {
    const { type = "info" } = payload;
    const finalPayload: LogPayload = {
      ...payload,
      type,
      appName: payload.appName || config.appName || "default",
      environment:
        payload.environment ||
        config.environment ||
        process.env.NODE_ENV ||
        "development",
    };
    await transport.send(finalPayload);
  };
  const createTypeMethod =
    (type: LogType) => (payload: Omit<LogPayload, "type">) =>
      send({ ...payload, type });

  return {
    send,
    info: createTypeMethod("info"),
    error: createTypeMethod("error"),
    metric: createTypeMethod("metric"),
    audit: createTypeMethod("audit"),
    warning: createTypeMethod("warning"),
    // get: (filters?: Record<string, any>) => transport.get(filters),
    // stream: (filters?: Record<string, any>) => transport.stream(filters),
  };
}
