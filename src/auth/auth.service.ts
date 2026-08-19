import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { UAParser } from 'ua-parser-js';
import {
  ACCESS_TOKEN_LIFETIME,
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EMAIL_VERIFICATION_TTL_MS,
  EMAIL_VERIFICATION_VERIFY_MIN_INTERVAL_MS,
  PASSWORD_RESET_CODE_LENGTH,
  PASSWORD_RESET_CODE_TTL_MS,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  PASSWORD_RESET_VERIFY_MIN_INTERVAL_MS,
  REFRESH_TOKEN_LIFETIME,
  TWO_FACTOR_CODE_LENGTH,
  TWO_FACTOR_CODE_TTL_MS,
  TWO_FACTOR_MAX_ATTEMPTS,
  TWO_FACTOR_TOKEN_TTL_MS,
  TWO_FACTOR_VERIFY_MIN_INTERVAL_MS,
} from '../constants';
import { GeoLocationService } from '../geolocation/geo-location.service';
import { MailService } from '../mail/mail.service';
import {
  AuthRepository,
  AuthSessionListRecord,
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthSessionInput,
  CreateAuthUserInput,
  PasswordResetRecord,
  TwoFactorChallengeRecord,
  UpdateEmailVerificationCodeInput,
} from './auth.repository';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { AuthSessionDto } from './dto/auth-session.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { PasswordResetTokenResponseDto } from './dto/password-reset-token-response.dto';
import { ResendTwoFactorDto } from './dto/resend-two-factor.dto';
import { ResendVerificationCodeDto } from './dto/resend-verification-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { TotpSetupResponseDto } from './dto/totp-setup-response.dto';
import { TwoFactorSettingsDto } from './dto/two-factor-settings.dto';
import { UpdateTwoFactorMethodDto } from './dto/update-two-factor-method.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';
import { VerifyTotpSetupDto } from './dto/verify-totp-setup.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { GoogleAuthUser } from './strategies/google.strategy';
import { TotpService } from './totp.service';
import { AuthTokensResult } from './types/auth-tokens-result.type';
import { AuthUserProfile } from './types/auth-user-profile.type';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { TwoFactorRequiredResult } from './types/two-factor-required-result.type';
import { ValidatedAuthUser } from './types/validated-auth-user.type';

type AuthRequestContext = {
  userAgent?: string;
  ipAddress?: string;
};

type TokenPayload = {
  sub: string;
  email: string;
  sessionId: string;
  role: 'member' | 'admin';
};

type PasswordResetTokenPayload = {
  sub: string;
  email: string;
  resetId: string;
};

type TwoFactorTokenPayload = {
  sub: string;
  email: string;
  challengeId: string;
  method: 'email' | 'totp';
};

function isPrismaUniqueConstraintError(
  error: unknown,
): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly mailService: MailService,
    private readonly totpService: TotpService,
    private readonly geoLocationService: GeoLocationService,
  ) {}

  async register(dto: SignUpDto): Promise<MessageResponseDto> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existingUser =
      await this.authRepository.findExistingUserByEmail(normalizedEmail);

    if (existingUser?.emailVerified) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      const verificationCode = this.generateEmailVerificationCode();
      const verificationCodeData =
        await this.buildEmailVerificationCodeData(verificationCode);
      const userData: CreateAuthUserInput = {
        email: normalizedEmail,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: await this.hashSecret(dto.password),
        role: this.getBootstrapAdminRole(normalizedEmail),
        ...verificationCodeData,
      };

      if (existingUser) {
        await this.authRepository.updatePendingAuthUser(
          existingUser.id,
          userData,
        );
      } else {
        await this.authRepository.createAuthUser(userData);
      }

      await this.mailService.sendVerificationCode(
        normalizedEmail,
        verificationCode,
      );

      return {
        message: 'Verification code sent to email.',
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error) && error.code === 'P2002') {
        throw new ConflictException(
          'User with these credentials already exists',
        );
      }

      throw error;
    }
  }

  async resendVerificationCode(
    dto: ResendVerificationCodeDto,
  ): Promise<MessageResponseDto> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.authRepository.findAuthUserByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Email is not registered');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    const verificationCode = this.generateEmailVerificationCode();
    const verificationCodeData =
      await this.buildEmailVerificationCodeData(verificationCode);

    await this.authRepository.updateEmailVerificationCode(
      user.id,
      verificationCodeData,
    );
    await this.mailService.sendVerificationCode(
      normalizedEmail,
      verificationCode,
    );

    return {
      message: 'Verification code resent to email.',
    };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    context: AuthRequestContext,
  ): Promise<AuthTokensResult | TwoFactorRequiredResult> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.authRepository.findAuthUserByEmail(normalizedEmail);

    if (!user?.passwordHash || !user.emailVerificationCodeHash) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    this.assertEmailVerificationRateLimit(user);

    if (
      !user.emailVerificationCodeExpiresAt ||
      user.emailVerificationCodeExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Verification code has expired');
    }

    const isCodeValid = await this.verifySecret(
      dto.code,
      user.emailVerificationCodeHash,
    );

    if (!isCodeValid) {
      const nextAttemptCount = user.emailVerificationAttemptCount + 1;
      const shouldConsume = nextAttemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS;

      await this.authRepository.registerFailedEmailVerificationAttempt(
        user.id,
        shouldConsume,
      );

      if (shouldConsume) {
        throw new HttpException(
          'Too many invalid verification attempts. Request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid verification code');
    }

    const verifiedUser = await this.syncInitialAdminRole(
      await this.authRepository.markEmailAsVerified(user.id),
    );

    return this.completePrimaryAuthentication(verifiedUser, context);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user =
      await this.authRepository.findPasswordResetUserByEmail(normalizedEmail);

    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset code has been sent.',
      };
    }

    const resetCode = this.generatePasswordResetCode();

    await this.authRepository.consumeActivePasswordResetsByUserId(user.id);
    await this.authRepository.createPasswordReset({
      userId: user.id,
      codeHash: await this.hashSecret(resetCode),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS),
    });
    await this.mailService.sendPasswordResetCode(normalizedEmail, resetCode);

    return {
      message:
        'If an account with that email exists, a password reset code has been sent.',
    };
  }

  async verifyPasswordResetCode(
    dto: VerifyPasswordResetDto,
  ): Promise<PasswordResetTokenResponseDto> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const reset =
      await this.authRepository.findLatestActivePasswordResetByEmail(
        normalizedEmail,
      );

    this.assertPasswordResetCanBeVerified(reset);
    this.assertPasswordResetRateLimit(reset);

    const isCodeValid = await this.verifySecret(dto.code, reset.codeHash);

    if (!isCodeValid) {
      const nextAttemptCount = reset.attemptCount + 1;
      const shouldConsume = nextAttemptCount >= PASSWORD_RESET_MAX_ATTEMPTS;

      await this.authRepository.registerFailedPasswordResetAttempt(
        reset.id,
        shouldConsume,
      );

      if (shouldConsume) {
        throw new HttpException(
          'Too many invalid password reset attempts. Request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid password reset code');
    }

    await this.authRepository.markPasswordResetVerified(reset.id);

    return {
      recoveryToken: await this.buildPasswordResetToken({
        sub: reset.userId,
        email: normalizedEmail,
        resetId: reset.id,
      }),
      message: 'Password reset code verified successfully.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const payload = await this.verifyPasswordResetToken(dto.recoveryToken);
    const reset = await this.authRepository.findPasswordResetById(
      payload.resetId,
    );

    this.assertPasswordResetCanBeConsumed(reset, payload);

    await this.authRepository.updateUserPassword(
      reset.userId,
      await this.hashSecret(dto.password),
    );
    await this.authRepository.consumePasswordReset(reset.id);
    await this.authRepository.consumeActivePasswordResetsByUserId(reset.userId);
    await this.authRepository.deleteSessionsByUserId(reset.userId);

    return {
      message: 'Password reset successfully.',
    };
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    await this.getRequiredUserProfile(user.userId);
    await this.authRepository.updateUserPassword(
      user.userId,
      await this.hashSecret(dto.newPassword),
    );
    await this.authRepository.deleteOtherSessionsByUserId(
      user.userId,
      this.getSessionId(user),
    );

    return {
      message: 'Password changed successfully.',
    };
  }

  async getTwoFactorSettings(
    user: AuthenticatedUser,
  ): Promise<TwoFactorSettingsDto> {
    const settings = await this.authRepository.findTwoFactorSettingsByUserId(
      user.userId,
    );

    if (!settings) {
      throw new InternalServerErrorException('Authenticated user not found');
    }

    return {
      isTwoFactorEnabled: settings.isTwoFactorEnabled,
      method: settings.twoFactorMethod,
      isTotpEnabled: settings.isTotpEnabled,
    };
  }

  async updateTwoFactorMethod(
    user: AuthenticatedUser,
    dto: UpdateTwoFactorMethodDto,
  ): Promise<TwoFactorSettingsDto> {
    const settings = await this.authRepository.findTwoFactorSettingsByUserId(
      user.userId,
    );

    if (!settings) {
      throw new InternalServerErrorException('Authenticated user not found');
    }

    if (dto.method === 'totp' && !settings.isTotpEnabled) {
      throw new UnprocessableEntityException(
        'TOTP setup is required before enabling TOTP 2FA.',
      );
    }

    const updatedSettings = await this.authRepository.updateTwoFactorMethod(
      user.userId,
      dto.method,
    );

    return {
      isTwoFactorEnabled: updatedSettings.isTwoFactorEnabled,
      method: updatedSettings.twoFactorMethod,
      isTotpEnabled: updatedSettings.isTotpEnabled,
    };
  }

  async createTotpSetup(
    user: AuthenticatedUser,
  ): Promise<TotpSetupResponseDto> {
    const setup = await this.authRepository.findTotpSetupByUserId(user.userId);

    if (!setup) {
      throw new InternalServerErrorException('Authenticated user not found');
    }

    if (setup.isTotpEnabled) {
      throw new ConflictException('TOTP is already configured');
    }

    const generatedSetup = this.totpService.generateSetup({
      issuer: this.getTotpIssuer(),
      accountName: setup.email,
    });

    await this.authRepository.saveTotpSecret(
      user.userId,
      generatedSetup.secret,
    );

    return generatedSetup;
  }

  async verifyTotpSetup(
    user: AuthenticatedUser,
    dto: VerifyTotpSetupDto,
  ): Promise<MessageResponseDto> {
    const setup = await this.authRepository.findTotpSetupByUserId(user.userId);

    if (!setup) {
      throw new InternalServerErrorException('Authenticated user not found');
    }

    if (!setup.totpSecret) {
      throw new UnprocessableEntityException('TOTP setup has not been started');
    }

    const isCodeValid = this.totpService.verifyCode(setup.totpSecret, dto.code);

    if (!isCodeValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.authRepository.enableTotp(user.userId);

    return {
      message: 'TOTP configured successfully.',
    };
  }

  async validateLoginCredentials(
    email: string,
    password: string,
  ): Promise<ValidatedAuthUser> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.authRepository.findAuthUserByEmail(normalizedEmail);

    if (!user?.passwordHash || !user.emailVerified) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.verifySecret(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const syncedUser = await this.syncInitialAdminRole(user);

    return {
      userId: syncedUser.id,
      email: syncedUser.email,
      role: syncedUser.role,
      isTwoFactorEnabled: syncedUser.isTwoFactorEnabled,
      twoFactorMethod: syncedUser.twoFactorMethod,
      isTotpEnabled: syncedUser.isTotpEnabled,
    };
  }

  async login(
    dto: SignInDto,
    context: AuthRequestContext,
  ): Promise<AuthTokensResult | TwoFactorRequiredResult> {
    const user = await this.validateLoginCredentials(dto.email, dto.password);

    return this.loginValidatedUser(user, context);
  }

  async loginValidatedUser(
    user: ValidatedAuthUser,
    context: AuthRequestContext,
  ): Promise<AuthTokensResult | TwoFactorRequiredResult> {
    if (user.isTwoFactorEnabled) {
      return this.startTwoFactorChallenge({
        userId: user.userId,
        email: user.email,
        method: user.twoFactorMethod,
      });
    }

    return this.issueAuthResponse(
      {
        sub: user.userId,
        email: user.email,
        sessionId: randomUUID(),
      },
      context,
      'User authenticated successfully.',
    );
  }

  async verifyTwoFactor(
    dto: VerifyTwoFactorDto,
    context: AuthRequestContext,
  ): Promise<AuthTokensResult> {
    const payload = await this.verifyTwoFactorToken(dto.twoFactorToken ?? '');
    const challenge = await this.authRepository.findTwoFactorChallengeById(
      payload.challengeId,
    );

    this.assertTwoFactorChallengeCanBeVerified(challenge, payload);
    this.assertTwoFactorChallengeRateLimit(challenge);

    const isCodeValid =
      payload.method === 'totp'
        ? challenge.user.totpSecret !== null &&
          this.totpService.verifyCode(challenge.user.totpSecret, dto.code)
        : await this.verifySecret(dto.code, challenge.codeHash);

    if (!isCodeValid) {
      const nextAttemptCount = challenge.attemptCount + 1;
      const shouldConsume = nextAttemptCount >= TWO_FACTOR_MAX_ATTEMPTS;

      await this.authRepository.registerFailedTwoFactorAttempt(
        challenge.id,
        shouldConsume,
      );

      if (shouldConsume) {
        throw new HttpException(
          'Too many invalid two-factor attempts. Start a new login.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid two-factor authentication code');
    }

    await this.authRepository.consumeTwoFactorChallenge(challenge.id);

    return this.issueAuthResponse(
      {
        sub: challenge.userId,
        email: challenge.user.email,
        sessionId: randomUUID(),
      },
      context,
      'User authenticated successfully.',
    );
  }

  async resendTwoFactorCode(
    dto: ResendTwoFactorDto,
  ): Promise<TwoFactorRequiredResult> {
    const payload = await this.verifyTwoFactorToken(dto.twoFactorToken ?? '');
    const challenge = await this.authRepository.findTwoFactorChallengeById(
      payload.challengeId,
    );

    this.assertTwoFactorChallengeCanBeResent(challenge, payload);

    if (payload.method === 'totp') {
      throw new UnprocessableEntityException(
        'Code resend is not available for TOTP.',
      );
    }

    return this.startTwoFactorChallenge({
      userId: challenge.userId,
      email: challenge.user.email,
      method: payload.method,
    });
  }

  async loginWithGoogle(
    googleUser: GoogleAuthUser,
    context: AuthRequestContext,
  ): Promise<AuthTokensResult | TwoFactorRequiredResult> {
    const normalizedEmail = this.normalizeEmail(googleUser.email);
    const existingGoogleUser = await this.authRepository.findAuthUserByGoogleId(
      googleUser.googleId,
    );

    if (existingGoogleUser) {
      return this.completePrimaryAuthentication(
        await this.syncInitialAdminRole(existingGoogleUser),
        context,
      );
    }

    const existingEmailUser =
      await this.authRepository.findAuthUserByEmail(normalizedEmail);

    if (existingEmailUser) {
      if (!googleUser.emailVerified) {
        throw new UnauthorizedException('Google account email is not verified');
      }

      if (
        existingEmailUser.googleId &&
        existingEmailUser.googleId !== googleUser.googleId
      ) {
        throw new ConflictException(
          'This email is already linked to another Google account',
        );
      }

      const linkedUser = await this.authRepository.linkGoogleAuthUser(
        existingEmailUser.id,
        {
          googleId: googleUser.googleId,
          emailVerified: true,
        },
      );

      return this.completePrimaryAuthentication(
        await this.syncInitialAdminRole(linkedUser),
        context,
      );
    }

    if (!googleUser.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const createdUser = await this.authRepository.createGoogleAuthUser({
      email: normalizedEmail,
      googleId: googleUser.googleId,
      authProvider: 'google',
      emailVerified: true,
      role: this.getBootstrapAdminRole(normalizedEmail),
      firstName: googleUser.firstName.trim(),
      lastName: googleUser.lastName.trim(),
      avatarUrl: googleUser.avatarUrl,
    });

    return this.completePrimaryAuthentication(createdUser, context);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.authRepository.findAuthSessionById(
      payload.sessionId,
    );

    this.assertSessionCanBeRefreshed(session, payload.sub);

    const isRefreshTokenValid = await this.verifySecret(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.getRequiredUserProfile(payload.sub);

    return this.rotateSessionTokens(session, payload, user);
  }

  async getSessions(user: AuthenticatedUser): Promise<AuthSessionDto[]> {
    const sessions = await this.authRepository.findActiveSessionsByUserId(
      user.userId,
    );

    return sessions.map((session) =>
      this.toAuthSessionDto(session, user.sessionId),
    );
  }

  async logout(user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.authRepository.deleteSessionById(this.getSessionId(user));

    return {
      message: 'User logged out successfully.',
    };
  }

  async logoutAllDevices(user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.authRepository.deleteSessionsByUserId(user.userId);

    return {
      message: 'User logged out of all devices successfully.',
    };
  }

  async deleteSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<MessageResponseDto> {
    const session = await this.authRepository.findAuthSessionById(sessionId);

    if (!session || session.userId !== user.userId) {
      throw new NotFoundException('Session not found');
    }

    await this.authRepository.deleteSessionById(sessionId);

    return {
      message: 'Session deleted successfully.',
    };
  }

  private async issueAuthResponse(
    payload: Omit<TokenPayload, 'role'>,
    context: AuthRequestContext,
    message: string,
  ): Promise<AuthTokensResult> {
    const user = await this.getRequiredUserProfile(payload.sub);
    const tokenPayload: TokenPayload = {
      sub: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      role: user.role,
    };
    const tokens = await this.buildTokenPair(tokenPayload);

    const sessionData: CreateAuthSessionInput = {
      id: payload.sessionId,
      userId: payload.sub,
      refreshTokenHash: await this.hashSecret(tokens.refreshToken),
      userAgent: context.userAgent,
      deviceName: this.buildDeviceName(context.userAgent),
      ipAddress: context.ipAddress,
      location: await this.geoLocationService.lookupCity(context.ipAddress),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME),
    };

    await this.authRepository.createAuthSession(sessionData);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      message,
      user,
    };
  }

  private async rotateSessionTokens(
    session: AuthSessionRecord,
    payload: TokenPayload,
    user: AuthUserProfile,
  ): Promise<AuthTokensResult> {
    const tokens = await this.buildTokenPair({
      sub: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      role: user.role,
    });
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME);

    await this.authRepository.rotateAuthSession(
      session.id,
      await this.hashSecret(tokens.refreshToken),
      expiresAt,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      message: 'Tokens refreshed successfully.',
      user,
    };
  }

  private async buildTokenPair(payload: TokenPayload) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Math.floor(ACCESS_TOKEN_LIFETIME / 1000),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: Math.floor(REFRESH_TOKEN_LIFETIME / 1000),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private buildPasswordResetToken(
    payload: PasswordResetTokenPayload,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>(
        'PASSWORD_RESET_TOKEN_SECRET',
      ),
      expiresIn: Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000),
    });
  }

  private buildTwoFactorToken(payload: TwoFactorTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('TWO_FACTOR_TOKEN_SECRET'),
      expiresIn: Math.floor(TWO_FACTOR_TOKEN_TTL_MS / 1000),
    });
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<Partial<TokenPayload>>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.sessionId !== 'string'
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        sessionId: payload.sessionId,
        role: payload.role === 'admin' ? 'admin' : 'member',
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async verifyPasswordResetToken(
    recoveryToken: string,
  ): Promise<PasswordResetTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<
        Partial<PasswordResetTokenPayload>
      >(recoveryToken, {
        secret: this.configService.getOrThrow<string>(
          'PASSWORD_RESET_TOKEN_SECRET',
        ),
      });

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.resetId !== 'string'
      ) {
        throw new UnauthorizedException('Invalid recovery token');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        resetId: payload.resetId,
      };
    } catch {
      throw new UnauthorizedException('Invalid recovery token');
    }
  }

  private async verifyTwoFactorToken(
    twoFactorToken: string,
  ): Promise<TwoFactorTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<
        Partial<TwoFactorTokenPayload>
      >(twoFactorToken, {
        secret: this.configService.getOrThrow<string>(
          'TWO_FACTOR_TOKEN_SECRET',
        ),
      });

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.challengeId !== 'string' ||
        (payload.method !== 'email' && payload.method !== 'totp')
      ) {
        throw new UnauthorizedException('Invalid two-factor token');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        challengeId: payload.challengeId,
        method: payload.method,
      };
    } catch {
      throw new UnauthorizedException('Invalid two-factor token');
    }
  }

  private async completePrimaryAuthentication(
    user: AuthUserRecord,
    context: AuthRequestContext,
  ): Promise<AuthTokensResult | TwoFactorRequiredResult> {
    if (user.isTwoFactorEnabled) {
      return this.startTwoFactorChallenge({
        userId: user.id,
        email: user.email,
        method: user.twoFactorMethod,
      });
    }

    return this.issueAuthResponse(
      {
        sub: user.id,
        email: user.email,
        sessionId: randomUUID(),
      },
      context,
      'User authenticated successfully.',
    );
  }

  private async startTwoFactorChallenge(input: {
    userId: string;
    email: string;
    method: 'email' | 'totp';
  }): Promise<TwoFactorRequiredResult> {
    if (input.method === 'totp') {
      const setup = await this.authRepository.findTotpSetupByUserId(
        input.userId,
      );

      if (!setup?.isTotpEnabled || !setup.totpSecret) {
        throw new UnprocessableEntityException(
          'TOTP setup is required before enabling TOTP 2FA.',
        );
      }
    }

    const code = this.generateTwoFactorCode();
    const challengeId = randomUUID();

    await this.authRepository.consumeActiveTwoFactorChallengesByUserId(
      input.userId,
      input.method,
    );
    await this.authRepository.createTwoFactorChallenge({
      id: challengeId,
      userId: input.userId,
      method: input.method,
      codeHash: await this.hashSecret(code),
      expiresAt: new Date(Date.now() + TWO_FACTOR_CODE_TTL_MS),
    });

    if (input.method === 'email') {
      await this.mailService.sendTwoFactorCode(input.email, code);
    }

    return {
      requiresTwoFactor: true,
      twoFactorToken: await this.buildTwoFactorToken({
        sub: input.userId,
        email: input.email,
        challengeId,
        method: input.method,
      }),
      method: input.method,
      message: 'Two-factor authentication code sent successfully.',
    };
  }

  private assertPasswordResetCanBeVerified(
    reset: PasswordResetRecord | null,
  ): asserts reset is PasswordResetRecord {
    if (!reset || reset.consumedAt) {
      throw new UnauthorizedException('Invalid password reset code');
    }

    if (reset.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Password reset code has expired');
    }
  }

  private assertPasswordResetCanBeConsumed(
    reset: PasswordResetRecord | null,
    payload: PasswordResetTokenPayload,
  ): asserts reset is PasswordResetRecord {
    if (
      !reset ||
      reset.userId !== payload.sub ||
      reset.user.email !== payload.email
    ) {
      throw new UnauthorizedException('Invalid recovery token');
    }

    if (!reset.verifiedAt || reset.consumedAt) {
      throw new UnauthorizedException('Invalid recovery token');
    }

    if (reset.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Recovery token has expired');
    }
  }

  private assertPasswordResetRateLimit(reset: PasswordResetRecord): void {
    if (
      reset.lastAttemptAt &&
      Date.now() - reset.lastAttemptAt.getTime() <
        PASSWORD_RESET_VERIFY_MIN_INTERVAL_MS
    ) {
      throw new HttpException(
        'Too many password reset attempts. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private assertTwoFactorChallengeCanBeVerified(
    challenge: TwoFactorChallengeRecord | null,
    payload: TwoFactorTokenPayload,
  ): asserts challenge is TwoFactorChallengeRecord {
    if (
      !challenge ||
      challenge.userId !== payload.sub ||
      challenge.user.email !== payload.email ||
      challenge.method !== payload.method
    ) {
      throw new UnauthorizedException('Invalid two-factor token');
    }

    if (challenge.consumedAt) {
      throw new UnauthorizedException('Invalid two-factor token');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(
        'Two-factor authentication code has expired',
      );
    }
  }

  private assertTwoFactorChallengeRateLimit(
    challenge: TwoFactorChallengeRecord,
  ): void {
    if (
      challenge.lastAttemptAt &&
      Date.now() - challenge.lastAttemptAt.getTime() <
        TWO_FACTOR_VERIFY_MIN_INTERVAL_MS
    ) {
      throw new HttpException(
        'Too many two-factor attempts. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private assertTwoFactorChallengeCanBeResent(
    challenge: TwoFactorChallengeRecord | null,
    payload: TwoFactorTokenPayload,
  ): asserts challenge is TwoFactorChallengeRecord {
    if (
      !challenge ||
      challenge.userId !== payload.sub ||
      challenge.user.email !== payload.email ||
      challenge.method !== payload.method
    ) {
      throw new UnauthorizedException('Invalid two-factor token');
    }
  }

  private assertEmailVerificationRateLimit(user: {
    emailVerificationLastAttemptAt: Date | null;
  }): void {
    if (
      user.emailVerificationLastAttemptAt &&
      Date.now() - user.emailVerificationLastAttemptAt.getTime() <
        EMAIL_VERIFICATION_VERIFY_MIN_INTERVAL_MS
    ) {
      throw new HttpException(
        'Too many verification attempts. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private assertSessionCanBeRefreshed(
    session: AuthSessionRecord | null,
    userId: string,
  ): asserts session is AuthSessionRecord {
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getBootstrapAdminRole(normalizedEmail: string): 'admin' | undefined {
    const initialAdminEmail = this.configService
      .get<string>('INITIAL_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();

    if (!initialAdminEmail) {
      return undefined;
    }

    return normalizedEmail === initialAdminEmail ? 'admin' : undefined;
  }

  private async syncInitialAdminRole(
    user: AuthUserRecord,
  ): Promise<AuthUserRecord> {
    if (this.getBootstrapAdminRole(user.email) !== 'admin') {
      return user;
    }

    if (user.role === 'admin') {
      return user;
    }

    return this.authRepository.promoteUserToAdmin(user.id);
  }

  private generateEmailVerificationCode(): string {
    return this.generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
  }

  private generatePasswordResetCode(): string {
    return this.generateNumericCode(PASSWORD_RESET_CODE_LENGTH);
  }

  private generateTwoFactorCode(): string {
    return this.generateNumericCode(TWO_FACTOR_CODE_LENGTH);
  }

  private generateNumericCode(length: number): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length;

    return randomInt(min, max).toString();
  }

  private async buildEmailVerificationCodeData(
    verificationCode: string,
  ): Promise<UpdateEmailVerificationCodeInput> {
    return {
      emailVerificationCodeHash: await this.hashSecret(verificationCode),
      emailVerificationCodeExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      ),
      emailVerificationAttemptCount: 0,
      emailVerificationLastAttemptAt: null,
    };
  }

  private getTotpIssuer(): string {
    return this.configService.get<string>('TOTP_ISSUER') ?? 'TradeMatrix';
  }

  private async getRequiredUserProfile(
    userId: string,
  ): Promise<AuthUserProfile> {
    const user = await this.authRepository.findAuthUserProfileById(userId);

    if (!user) {
      throw new InternalServerErrorException('Authenticated user not found');
    }

    return user;
  }

  private toAuthSessionDto(
    session: AuthSessionListRecord,
    currentSessionId: string,
  ): AuthSessionDto {
    const lastUsedAt = session.lastUsedAt ?? session.createdAt;

    return {
      id: session.id,
      device: session.deviceName ?? 'Unknown device',
      location: session.location,
      createdAt: session.createdAt,
      updatedAt: lastUsedAt,
      isCurrent: session.id === currentSessionId,
      isActive: !session.revokedAt && session.expiresAt.getTime() > Date.now(),
    };
  }

  private buildDeviceName(userAgent?: string): string | undefined {
    if (!userAgent) {
      return undefined;
    }

    const result = new UAParser(userAgent).getResult();
    const browser = result.browser.name;
    const os = result.os.name;
    const deviceModel = result.device.model;
    const deviceType = result.device.type;

    if (deviceModel) {
      return os ? `${deviceModel} (${os})` : deviceModel;
    }

    if (browser && os) {
      return `${browser} on ${os}`;
    }

    if (os) {
      return `${this.toDeviceTypeLabel(deviceType)} (${os})`;
    }

    return this.toDeviceTypeLabel(deviceType);
  }

  private toDeviceTypeLabel(deviceType?: string): string {
    if (deviceType === 'mobile') {
      return 'Mobile';
    }

    if (deviceType === 'tablet') {
      return 'Tablet';
    }

    return 'Desktop';
  }

  private getSessionId(user: unknown): string {
    if (typeof user !== 'object' || user === null) {
      throw new UnauthorizedException('Invalid access token');
    }

    const { sessionId } = user as Record<string, unknown>;

    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new UnauthorizedException('Invalid access token');
    }

    return sessionId;
  }

  private hashSecret(value: string): Promise<string> {
    return bcrypt.hash(value, 10);
  }

  private verifySecret(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
