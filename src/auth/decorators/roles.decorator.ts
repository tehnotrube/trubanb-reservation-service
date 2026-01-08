import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../roles.guard';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access a route
 * Usage: @Roles(UserRole.HOST, UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
