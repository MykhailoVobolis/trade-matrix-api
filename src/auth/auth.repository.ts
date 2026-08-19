import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthUserProfile } from './types/auth-user-profile.type';

export type CreateAuthUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role?: 'member' | 'admin';
  emailVerificationCodeHash: string;
  emailVerificationCodeExpiresAt: Date;
  emailVerificationAttemptCount: number;
  emailVerificationLastAttemptAt: null;
};

export type UpdatePendingAuthUserInput = CreateAuthUserInput;

export type CreateGoogleAuthUserInput = {
  email: string;
  googleId: string;
  authProvider: 'google';
  emailVerified: boolean;
  role?: 'member' | 'admin';
  firstName: string;
  lastName: string;
  avatarUrl?: string;
};

export type UpdateEmailVerificationCodeInput = {
  emailVerificationCodeHash: string;
  emailVerificationCodeExpiresAt: Date;
  emailVerificationAttemptCount: number;
  emailVerificationLastAttemptAt: null;
};

export type LinkGoogleAuthUserInput = {
  googleId: string;
  emailVerified: boolean;
};

export type CreatePasswordResetInput = {
  userId: string;
  codeHash: string;
  expiresAt: Date;
};

export type CreateTwoFactorChallengeInput = {
  id: string;
  userId: string;
  method: 'email' | 'totp';
  codeHash: string;
  expiresAt: Date;
};

export type CreateAuthSessionInput = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  deviceName?: string;
  ipAddress?: string;
  location?: string | null;
  lastUsedAt: Date;
  expiresAt: Date;
};

const existingUserLookupSelect = {
  id: true,
  email: true,
  emailVerified: true,
} satisfies Prisma.UserSelect;

export type ExistingUserLookup = Prisma.UserGetPayload<{
  select: typeof existingUserLookupSelect;
}>;

const passwordResetUserLookupSelect = {
  id: true,
  email: true,
} satisfies Prisma.UserSelect;

const authUserSelect = {
  id: true,
  email: true,
  googleId: true,
  authProvider: true,
  isTwoFactorEnabled: true,
  twoFactorMethod: true,
  isTotpEnabled: true,
  totpSecret: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  avatarPublicId: true,
  passwordHash: true,
  emailVerified: true,
  emailVerificationCodeHash: true,
  emailVerificationCodeExpiresAt: true,
  emailVerificationAttemptCount: true,
  emailVerificationLastAttemptAt: true,
} satisfies Prisma.UserSelect;

export type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;

const authUserProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const twoFactorSettingsSelect = {
  isTwoFactorEnabled: true,
  twoFactorMethod: true,
  isTotpEnabled: true,
} satisfies Prisma.UserSelect;

export type TwoFactorSettingsRecord = Prisma.UserGetPayload<{
  select: typeof twoFactorSettingsSelect;
}>;

const totpSetupSelect = {
  id: true,
  email: true,
  isTotpEnabled: true,
  totpSecret: true,
} satisfies Prisma.UserSelect;

export type TotpSetupRecord = Prisma.UserGetPayload<{
  select: typeof totpSetupSelect;
}>;

const authSessionListSelect = {
  id: true,
  userId: true,
  deviceName: true,
  location: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SessionSelect;

export type AuthSessionListRecord = Prisma.SessionGetPayload<{
  select: typeof authSessionListSelect;
}>;

const authSessionSelect = {
  id: true,
  userId: true,
  refreshTokenHash: true,
  userAgent: true,
  deviceName: true,
  ipAddress: true,
  expiresAt: true,
  revokedAt: true,
} satisfies Prisma.SessionSelect;

export type AuthSessionRecord = Prisma.SessionGetPayload<{
  select: typeof authSessionSelect;
}>;

const twoFactorChallengeSelect = {
  id: true,
  userId: true,
  method: true,
  codeHash: true,
  attemptCount: true,
  lastAttemptAt: true,
  expiresAt: true,
  consumedAt: true,
  user: {
    select: {
      email: true,
      totpSecret: true,
    },
  },
} satisfies Prisma.TwoFactorChallengeSelect;

export type TwoFactorChallengeRecord = Prisma.TwoFactorChallengeGetPayload<{
  select: typeof twoFactorChallengeSelect;
}>;

const passwordResetSelect = {
  id: true,
  userId: true,
  codeHash: true,
  attemptCount: true,
  lastAttemptAt: true,
  expiresAt: true,
  verifiedAt: true,
  consumedAt: true,
  user: {
    select: {
      email: true,
    },
  },
} satisfies Prisma.PasswordResetSelect;

export type PasswordResetRecord = Prisma.PasswordResetGetPayload<{
  select: typeof passwordResetSelect;
}>;

type AuthPrismaClient = Pick<
  PrismaClient,
  'user' | 'session' | 'passwordReset' | 'twoFactorChallenge'
>;

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(PrismaClient) private readonly prisma: AuthPrismaClient,
  ) {}

  findExistingUserByEmail(email: string): Promise<ExistingUserLookup | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: existingUserLookupSelect,
    });
  }

  findPasswordResetUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: passwordResetUserLookupSelect,
    });
  }

  findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: authUserSelect,
    });
  }

  findAuthUserByGoogleId(googleId: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
      select: authUserSelect,
    });
  }

  createAuthUser(data: CreateAuthUserInput): Promise<AuthUserRecord> {
    return this.prisma.user.create({
      data,
      select: authUserSelect,
    });
  }

  createGoogleAuthUser(
    data: CreateGoogleAuthUserInput,
  ): Promise<AuthUserRecord> {
    return this.prisma.user.create({
      data,
      select: authUserSelect,
    });
  }

  async findAuthUserProfileById(
    userId: string,
  ): Promise<AuthUserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserProfileSelect,
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }

  findTwoFactorSettingsByUserId(
    userId: string,
  ): Promise<TwoFactorSettingsRecord | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: twoFactorSettingsSelect,
    });
  }

  findTotpSetupByUserId(userId: string): Promise<TotpSetupRecord | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: totpSetupSelect,
    });
  }

  updatePendingAuthUser(
    userId: string,
    data: UpdatePendingAuthUserInput,
  ): Promise<AuthUserRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: authUserSelect,
    });
  }

  markEmailAsVerified(userId: string): Promise<AuthUserRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationCodeHash: null,
        emailVerificationCodeExpiresAt: null,
        emailVerificationAttemptCount: 0,
        emailVerificationLastAttemptAt: null,
      },
      select: authUserSelect,
    });
  }

  updateEmailVerificationCode(
    userId: string,
    data: UpdateEmailVerificationCodeInput,
  ): Promise<AuthUserRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: authUserSelect,
    });
  }

  async updateUserPassword(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  promoteUserToAdmin(userId: string): Promise<AuthUserRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'admin' },
      select: authUserSelect,
    });
  }

  linkGoogleAuthUser(
    userId: string,
    data: LinkGoogleAuthUserInput,
  ): Promise<AuthUserRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: authUserSelect,
    });
  }

  updateTwoFactorMethod(
    userId: string,
    method: 'email' | 'totp',
  ): Promise<TwoFactorSettingsRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorMethod: method,
      },
      select: twoFactorSettingsSelect,
    });
  }

  saveTotpSecret(userId: string, totpSecret: string): Promise<TotpSetupRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret,
        isTotpEnabled: false,
      },
      select: totpSetupSelect,
    });
  }

  enableTotp(userId: string): Promise<TotpSetupRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isTotpEnabled: true,
      },
      select: totpSetupSelect,
    });
  }

  async createAuthSession(data: CreateAuthSessionInput): Promise<void> {
    await this.prisma.session.create({ data });
  }

  findActiveSessionsByUserId(userId: string): Promise<AuthSessionListRecord[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: authSessionListSelect,
    });
  }

  findAuthSessionById(sessionId: string): Promise<AuthSessionRecord | null> {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      select: authSessionSelect,
    });
  }

  async rotateAuthSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt,
      },
    });
  }

  async deleteSessionById(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  deleteSessionsByUserId(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  deleteOtherSessionsByUserId(
    userId: string,
    currentSessionId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: {
        userId,
        id: {
          not: currentSessionId,
        },
      },
    });
  }

  async createPasswordReset(data: CreatePasswordResetInput): Promise<void> {
    await this.prisma.passwordReset.create({ data });
  }

  async createTwoFactorChallenge(
    data: CreateTwoFactorChallengeInput,
  ): Promise<void> {
    await this.prisma.twoFactorChallenge.create({
      data: {
        ...data,
        method: data.method,
      },
    });
  }

  consumeActiveTwoFactorChallengesByUserId(
    userId: string,
    method: 'email' | 'totp',
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.twoFactorChallenge.updateMany({
      where: {
        userId,
        method: method,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  findTwoFactorChallengeById(
    challengeId: string,
  ): Promise<TwoFactorChallengeRecord | null> {
    return this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
      select: twoFactorChallengeSelect,
    });
  }

  async consumeTwoFactorChallenge(challengeId: string): Promise<void> {
    await this.prisma.twoFactorChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
  }

  async registerFailedTwoFactorAttempt(
    challengeId: string,
    shouldConsume: boolean,
  ): Promise<number> {
    const challenge = await this.prisma.twoFactorChallenge.update({
      where: { id: challengeId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        consumedAt: shouldConsume ? new Date() : undefined,
      },
      select: { attemptCount: true },
    });

    return challenge.attemptCount;
  }

  async registerFailedEmailVerificationAttempt(
    userId: string,
    shouldConsume: boolean,
  ): Promise<number> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationAttemptCount: { increment: 1 },
        emailVerificationLastAttemptAt: new Date(),
        ...(shouldConsume
          ? {
              emailVerificationCodeHash: null,
              emailVerificationCodeExpiresAt: null,
            }
          : {}),
      },
      select: { emailVerificationAttemptCount: true },
    });

    return user.emailVerificationAttemptCount;
  }

  consumeActivePasswordResetsByUserId(
    userId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.passwordReset.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
  }

  findLatestActivePasswordResetByEmail(
    email: string,
  ): Promise<PasswordResetRecord | null> {
    return this.prisma.passwordReset.findFirst({
      where: {
        consumedAt: null,
        user: { email },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: passwordResetSelect,
    });
  }

  findPasswordResetById(resetId: string): Promise<PasswordResetRecord | null> {
    return this.prisma.passwordReset.findUnique({
      where: { id: resetId },
      select: passwordResetSelect,
    });
  }

  async markPasswordResetVerified(resetId: string): Promise<void> {
    await this.prisma.passwordReset.update({
      where: { id: resetId },
      data: { verifiedAt: new Date() },
    });
  }

  async consumePasswordReset(resetId: string): Promise<void> {
    await this.prisma.passwordReset.update({
      where: { id: resetId },
      data: { consumedAt: new Date() },
    });
  }

  async registerFailedPasswordResetAttempt(
    resetId: string,
    shouldConsume: boolean,
  ): Promise<number> {
    const reset = await this.prisma.passwordReset.update({
      where: { id: resetId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        consumedAt: shouldConsume ? new Date() : undefined,
      },
      select: { attemptCount: true },
    });

    return reset.attemptCount;
  }
}
