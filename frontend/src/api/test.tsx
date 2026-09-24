import { useEffect } from "react";
import { logger } from "../lib/logs";

export function LogFunction() {
  useEffect(() => {
    const sendLog = async () => {
      try {
        await logger.info({
          message: "User logged in successfully",
          importance: "medium",
          service: "auth-service",
        });
      } catch (err) {
        console.error(err);
      }
    };
    sendLog();
  }, []);
  return <div></div>
}
