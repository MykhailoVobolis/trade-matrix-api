export type ValidatedAuthUser = {
  userId: string;
  email: string;
  role: 'member' | 'admin';
  isTwoFactorEnabled: boolean;
  twoFactorMethod: 'email' | 'totp';
  isTotpEnabled: boolean;
};
