import { Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ClerkService {
  readonly client = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  });
}
