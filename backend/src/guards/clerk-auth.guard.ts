import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ClerkAuthGuard extends AuthGuard('clerk') {
  constructor() {
    super();
  }
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
