import { Generated } from 'kysely';

export interface IApiKeyTable {
  id: Generated<string>;
  user_id: string;
  prefix: string;
  api_name: string;
  hashed_key: string;
  created_at: Generated<Date>;
  last_used_at: Date | null;
  revoked_at: Date | null;
}
