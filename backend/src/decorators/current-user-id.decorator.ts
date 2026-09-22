import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    if (request.user) return request.user.id;
    else if (request.userId) return request.userId;
    throw new UnauthorizedException('Unauthorized');
  },
);
