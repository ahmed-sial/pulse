import { IApiKeyTable } from './tables/api-key.table.js';

export interface IDatabase {
  api_keys: IApiKeyTable;
}
