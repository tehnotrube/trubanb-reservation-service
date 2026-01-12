import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

export enum UserRole {
  GUEST = 'guest',
  HOST = 'host',
  ADMIN = 'admin',
}

/**
 * Guard that checks if the user has the required role(s)
 * Works in conjunction with @Roles() decorator
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    const hasRole = requiredRoles.some((role) => userRole.toLowerCase() === role.toLowerCase());

    if (!hasRole) {
      throw new ForbiddenException(
        `User role '${userRole}' does not have access. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
