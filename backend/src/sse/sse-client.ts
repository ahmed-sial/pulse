import { SSEFilters } from '../types/sse-filters.js';
import { Response } from 'express';

export interface SSEClient {
  res: Response;
  filters: SSEFilters;
}
