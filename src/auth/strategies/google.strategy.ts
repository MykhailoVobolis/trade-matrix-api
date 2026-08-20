import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile,
  Strategy as GoogleOAuth2Strategy,
} from 'passport-google-oauth20';

export type GoogleAuthUser = {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  googleId: string;
  emailVerified: boolean;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleOAuth2Strategy,
  'google',
) {
  constructor(configService: ConfigService) {
    super({
      clientID:
        configService.get<string>('GOOGLE_AUTH_CLIENT_ID') || 'disabled',
      clientSecret:
        configService.get<string>('GOOGLE_AUTH_CLIENT_SECRET') || 'disabled',
      callbackURL:
        configService.get<string>('GOOGLE_AUTH_CALLBACK_URL') ||
        'http://localhost:8000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleAuthUser {
    const primaryEmail = profile.emails?.[0]?.value?.trim().toLowerCase();

    if (!primaryEmail) {
      throw new UnauthorizedException('Google account email is not available');
    }

    return {
      email: primaryEmail,
      firstName: profile.name?.givenName?.trim() || profile.displayName || '',
      lastName: profile.name?.familyName?.trim() || '',
      avatarUrl: profile.photos?.[0]?.value,
      googleId: profile.id,
      emailVerified: profile.emails?.[0]?.verified === true,
    };
  }
}
