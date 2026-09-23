import { AuthStatus } from "./index.js";

export interface LogSecurity {
  auth_status?: AuthStatus;
  suspicious?: boolean;
  tags?: string[];
}
