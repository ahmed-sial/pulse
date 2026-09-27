import { IApiKeyTable } from './tables/api-key.table.js';
import { IPlanTable } from './tables/plan.table.js';
import { IUsageTable } from './tables/usage.table.js';

export interface IDatabase {
  api_keys: IApiKeyTable;
  usage: IUsageTable;
  plan: IPlanTable;
}
