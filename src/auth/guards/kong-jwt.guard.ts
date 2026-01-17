import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { UserRole } from '../enums/user-role.enum';

interface RequestWithHeaders {
  headers: {
    'x-user-id'?: string;
    'x-user-email'?: string;
    'x-user-role'?: string;
  };
  user?: AuthenticatedUser;
}

@Injectable()
export class KongJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();

    const userId = request.headers['x-user-id'];
    const userEmail = request.headers['x-user-email'];
    const userRole = request.headers['x-user-role'] as UserRole | undefined;

    if (!userId) {
      throw new UnauthorizedException(
        'No user information found in request headers',
      );
    }

    const user: AuthenticatedUser = {
      id: userId,
      email: userEmail ?? '',
      role: userRole ?? UserRole.GUEST,
    };

    request.user = user;

    return true;
  }
}
