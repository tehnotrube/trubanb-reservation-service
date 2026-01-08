import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard that extracts user information from Kong-injected headers
 * Kong JWT plugin validates the token and injects these headers:
 * - X-User-Id: User's unique identifier
 * - X-User-Email: User's email address
 * - X-User-Role: User's role (guest, host, admin)
 */
@Injectable()
export class KongJwtGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract user info from Kong headers
    const userId = request.headers['x-user-id'];
    const userEmail = request.headers['x-user-email'];
    const userRole = request.headers['x-user-role'];

    if (!userId) {
      throw new UnauthorizedException('No user information found in request headers');
    }

    // Attach user info to request object for use in controllers
    request.user = {
      id: userId,
      email: userEmail,
      role: userRole,
    };

    return true;
  }
}
