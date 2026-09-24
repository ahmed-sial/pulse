import { createLogger } from 'pulse';
import dotenv from 'dotenv';
dotenv.config();

export const logger = createLogger({
  apiKey: process.env.PLS_LOGS_API_KEY!,
  appName: 'my-react-app',
  environment: process.env.NODE_ENV || 'development',
});
