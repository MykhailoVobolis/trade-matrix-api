import { AuthUserProfile } from './auth-user-profile.type';

export type AuthTokensResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  message: string;
  user: AuthUserProfile;
};
