export type AuthenticatedUser = {
  userId: string;
  email: string;
  sessionId: string;
  role: 'member' | 'admin';
};
