-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('member', 'admin');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google');

-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('email', 'totp');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'local',
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorMethod" "TwoFactorMethod" NOT NULL DEFAULT 'email',
    "isTotpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationCodeHash" TEXT,
    "emailVerificationCodeExpiresAt" TIMESTAMP(3),
    "emailVerificationAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "emailVerificationLastAttemptAt" TIMESTAMP(3),
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "avatarUrl" TEXT,
    "avatarPublicId" TEXT,
    "passwordHash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "TwoFactorMethod" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "location" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordReset_verifiedAt_idx" ON "PasswordReset"("verifiedAt");

-- CreateIndex
CREATE INDEX "PasswordReset_consumedAt_idx" ON "PasswordReset"("consumedAt");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_userId_idx" ON "TwoFactorChallenge"("userId");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_method_idx" ON "TwoFactorChallenge"("method");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_expiresAt_idx" ON "TwoFactorChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_consumedAt_idx" ON "TwoFactorChallenge"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
