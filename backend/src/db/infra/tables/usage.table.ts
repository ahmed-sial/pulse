import { Generated } from 'kysely';

export interface IUsageTable {
  id: Generated<string>;
  user_id: string;
  events_usage: bigint;
  events_limit: bigint;
  created_at: Generated<Date>;
  updated_at: Date | null;
}
