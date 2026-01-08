import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to inject the current user into a controller method
 * Usage: @CurrentUser() user: any
 *
 * Returns user object with: { id, email, role }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
