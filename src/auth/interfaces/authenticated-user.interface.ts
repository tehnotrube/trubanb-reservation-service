import { UserRole } from '../guards/roles.guard';

/**
 * Interface representing an authenticated user extracted from JWT claims
 * This is populated by Kong via X-User-* headers
 */
export interface AuthenticatedUser {
  /** User ID from JWT 'sub' claim */
  id: string;

  /** User email from JWT 'email' claim */
  email: string;

  /** User role from JWT 'role' claim */
  role: UserRole;
}
