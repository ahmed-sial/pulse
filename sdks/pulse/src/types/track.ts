import { UserRole } from "./index.js";

export interface LogTrack {
  user_id?: string;
  role?: UserRole;
  ip?: string;
  user_agent?: string;
  geo?: string;
}
