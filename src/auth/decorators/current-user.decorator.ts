import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  <TUser = unknown>(_data: unknown, ctx: ExecutionContext): TUser => {
    const request = ctx.switchToHttp().getRequest<{ user: TUser }>();

    return request.user;
  },
);
