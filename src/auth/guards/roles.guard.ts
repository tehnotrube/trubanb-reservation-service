import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role: UserRole } }>();
    const userRole: UserRole | undefined = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    const hasRole = requiredRoles.some(
      (role: UserRole) =>
        (userRole as string).toLowerCase() === (role as string).toLowerCase(),
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `User role '${userRole}' does not have access. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
