import { SSEFilters } from '../types/sse-filters.js';
import { Response } from 'express';
import { SSEClient } from './sse-client.js';

const clients: SSEClient[] = [];

export function addClient(res: Response, filters: SSEFilters) {
  clients.push({ res, filters });
}
