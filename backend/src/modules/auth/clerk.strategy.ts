import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { verifyToken, type ClerkClient, type User } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CLERK_CLIENT } from './clerk.provider.js';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  constructor(
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
    private readonly config: ConfigService,
  ) {
    super();
  }
  async validate(req: Request): Promise<User> {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
      throw new UnauthorizedException('Authorization token is required');
    try {
      const tokenPayload = await verifyToken(token, {
        secretKey: this.config.getOrThrow('CLERK_SECRET_KEY'),
      });
      if (!tokenPayload) throw new UnauthorizedException('Token not verified');
      const user = await this.clerkClient.users.getUser(tokenPayload.sub);
      return user;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
