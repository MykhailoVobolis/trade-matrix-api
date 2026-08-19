import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/roles.constant';

export const Roles = (...roles: Array<'member' | 'admin'>) =>
  SetMetadata(ROLES_KEY, roles);
