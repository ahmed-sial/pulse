import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';

export const CLERK_CLIENT = 'CLERK_CLIENT';

export const ClerkClientProvider = {
  provide: CLERK_CLIENT,
  useFactory: (configService: ConfigService) => {
    return createClerkClient({
      publishableKey: configService.get('CLERK_PUBLISHABLE_KEY'),
      secretKey: configService.get('CLERK_SECRET_KEY'),
    });
  },
  inject: [ConfigService],
};
