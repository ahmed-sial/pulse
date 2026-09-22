import {
  CanActivate,
  ExecutionContext,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export function OrGuard(...guards: Type<CanActivate>[]): Type<CanActivate> {
  @Injectable()
  class OrGuardMixin implements CanActivate {
    constructor(private readonly moduleRef: ModuleRef) {}
    async canActivate(context: ExecutionContext) {
      for (const Guard of guards) {
        try {
          const guard = this.moduleRef.get(Guard, { strict: false });
          if (!guard) continue;
          const result = await guard.canActivate(context);
          if (
            result === true ||
            (typeof result == 'object' && 'then' in result && (await result))
          )
            return true;
        } catch (err) {
          continue;
        }
      }
      return false;
    }
  }
  return mixin(OrGuardMixin);
}
