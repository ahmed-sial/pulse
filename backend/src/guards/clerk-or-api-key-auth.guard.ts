import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyAuthGuard } from './api-key-auth.guard.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class ClerkOrApiKeyAuthGuard extends ClerkAuthGuard {
  constructor(
    private readonly ref: Reflector,
    private readonly apikeyAuthGuard: ApiKeyAuthGuard,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.ref.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    if (req.headers.authorization) {
      const result = await super.canActivate(context);
      if (result) return true;
    } else if (req.headers['x-api-key']) {
      const result = await this.apikeyAuthGuard.canActivate(context);
      return result;
    }
    return false;
  }
}
