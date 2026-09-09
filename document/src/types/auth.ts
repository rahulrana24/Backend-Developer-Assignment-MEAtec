import { Role } from '../constants/roles';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
