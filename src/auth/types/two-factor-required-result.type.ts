export type TwoFactorRequiredResult = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  method: 'email' | 'totp';
  message: string;
};
