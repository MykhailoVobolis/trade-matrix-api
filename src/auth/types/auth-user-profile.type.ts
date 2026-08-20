export type AuthUserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'member' | 'admin';
  avatarUrl: string | null;
};
