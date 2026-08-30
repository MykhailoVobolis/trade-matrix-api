import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { REFRESH_TOKEN_LIFETIME } from '../constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuthSessionDto } from './dto/auth-session.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { PasswordResetTokenResponseDto } from './dto/password-reset-token-response.dto';
import { ResendTwoFactorDto } from './dto/resend-two-factor.dto';
import { ResendVerificationCodeDto } from './dto/resend-verification-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { TotpSetupResponseDto } from './dto/totp-setup-response.dto';
import { TwoFactorRequiredResponseDto } from './dto/two-factor-required-response.dto';
import { TwoFactorSettingsDto } from './dto/two-factor-settings.dto';
import { UpdateTwoFactorMethodDto } from './dto/update-two-factor-method.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';
import { VerifyTotpSetupDto } from './dto/verify-totp-setup.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { GoogleAuthUser } from './strategies/google.strategy';
import type { AuthTokensResult } from './types/auth-tokens-result.type';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import type { TwoFactorRequiredResult } from './types/two-factor-required-result.type';
import type { ValidatedAuthUser } from './types/validated-auth-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiOkResponse({ type: MessageResponseDto })
  register(@Body() dto: SignUpDto): Promise<MessageResponseDto> {
    return this.authService.register(dto);
  }

  @Post('register/resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiOkResponse({ type: MessageResponseDto })
  resendVerificationCode(
    @Body() dto: ResendVerificationCodeDto,
  ): Promise<MessageResponseDto> {
    return this.authService.resendVerificationCode(dto);
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with a 6-digit code' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired verification code',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many verification attempts.',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const resolvedClientIp = this.resolveClientIp(req);
    this.logAuthClientIp('register_verify', req, resolvedClientIp);

    const authResult = await this.authService.verifyEmail(dto, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: resolvedClientIp,
    });

    this.setRefreshTokenCookie(res, authResult.refreshToken);

    return this.toAuthResponse(authResult);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset code to email' })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @Post('forgot-password/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password reset code' })
  @ApiOkResponse({ type: PasswordResetTokenResponseDto })
  verifyPasswordResetCode(
    @Body() dto: VerifyPasswordResetDto,
  ): Promise<PasswordResetTokenResponseDto> {
    return this.authService.verifyPasswordResetCode(dto);
  }

  @Post('forgot-password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using recovery token' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for the current user' })
  @ApiOkResponse({ type: MessageResponseDto })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.changePassword(user, dto);

    this.clearRefreshTokenCookie(res);

    return result;
  }

  @Get('2fa/settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current two-factor authentication settings' })
  @ApiOkResponse({ type: TwoFactorSettingsDto })
  getTwoFactorSettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSettingsDto> {
    return this.authService.getTwoFactorSettings(user);
  }

  @Patch('2fa/method')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update preferred two-factor authentication method',
  })
  @ApiOkResponse({ type: TwoFactorSettingsDto })
  updateTwoFactorMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTwoFactorMethodDto,
  ): Promise<TwoFactorSettingsDto> {
    return this.authService.updateTwoFactorMethod(user, dto);
  }

  @Post('2fa/totp/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start TOTP setup' })
  @ApiOkResponse({ type: TotpSetupResponseDto })
  createTotpSetup(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TotpSetupResponseDto> {
    return this.authService.createTotpSetup(user);
  }

  @Post('2fa/totp/verify-setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify TOTP setup' })
  @ApiOkResponse({ type: MessageResponseDto })
  verifyTotpSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyTotpSetupDto,
  ): Promise<MessageResponseDto> {
    return this.authService.verifyTotpSetup(user, dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Authenticate a user' })
  @ApiOkResponse({
    description: 'Returns auth tokens or a pending 2FA challenge.',
  })
  async login(
    @Body() _dto: SignInDto,
    @CurrentUser() user: ValidatedAuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto | TwoFactorRequiredResponseDto> {
    const resolvedClientIp = this.resolveClientIp(req);
    this.logAuthClientIp('login', req, resolvedClientIp);

    const authResult = await this.authService.loginValidatedUser(user, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: resolvedClientIp,
    });

    if (this.isTwoFactorRequired(authResult)) {
      this.setTwoFactorTokenCookie(res, authResult.twoFactorToken);
      return authResult;
    }

    this.setRefreshTokenCookie(res, authResult.refreshToken);

    return this.toAuthResponse(authResult);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify two-factor authentication code' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const resolvedClientIp = this.resolveClientIp(req);
    this.logAuthClientIp('two_factor_verify', req, resolvedClientIp);

    const authResult = await this.authService.verifyTwoFactor(
      {
        ...dto,
        twoFactorToken:
          dto.twoFactorToken ?? this.getTwoFactorTokenFromRequest(req),
      },
      {
        userAgent: req.get('user-agent') ?? undefined,
        ipAddress: resolvedClientIp,
      },
    );

    this.clearTwoFactorTokenCookie(res);
    this.setRefreshTokenCookie(res, authResult.refreshToken);

    return this.toAuthResponse(authResult);
  }

  @Post('2fa/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend two-factor authentication code' })
  @ApiOkResponse({ type: TwoFactorRequiredResponseDto })
  async resendTwoFactorCode(
    @Body() dto: ResendTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TwoFactorRequiredResponseDto> {
    const result = await this.authService.resendTwoFactorCode({
      ...dto,
      twoFactorToken:
        dto.twoFactorToken ?? this.getTwoFactorTokenFromRequest(req),
    });

    this.setTwoFactorTokenCookie(res, result.twoFactorToken);

    return result;
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active user sessions' })
  @ApiOkResponse({ type: [AuthSessionDto] })
  getSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthSessionDto[]> {
    return this.authService.getSessions(user);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete one user session' })
  @ApiParam({ name: 'sessionId', example: 'cmorabc123session' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiNotFoundResponse({ description: 'Session not found' })
  async deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.deleteSession(user, sessionId);

    if (sessionId === user.sessionId) {
      this.clearRefreshTokenCookie(res);
    }

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh auth tokens' })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = this.getRefreshTokenFromRequest(req);
    const authResult = await this.authService.refresh(refreshToken);

    this.setRefreshTokenCookie(res, authResult.refreshToken);

    return this.toAuthResponse(authResult);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out the current user' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logout(user);
    this.clearRefreshTokenCookie(res);
    return result;
  }

  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out the current user from all devices' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logoutAllDevices(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logoutAllDevices(user);
    this.clearRefreshTokenCookie(res);
    return result;
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth authentication' })
  googleAuth(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async googleAuthRedirect(
    @Req() req: Request & { user: GoogleAuthUser },
    @Res() res: Response,
  ): Promise<void> {
    const resolvedClientIp = this.resolveClientIp(req);
    this.logAuthClientIp('google_callback', req, resolvedClientIp);

    const authResult = await this.authService.loginWithGoogle(req.user, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: resolvedClientIp,
    });

    if (this.isTwoFactorRequired(authResult)) {
      this.setTwoFactorTokenCookie(res, authResult.twoFactorToken);
      res.redirect(this.buildGoogleTwoFactorRedirectUrl(authResult.method));
      return;
    }

    this.setRefreshTokenCookie(res, authResult.refreshToken);
    res.redirect(this.getGoogleSuccessRedirectUrl());
  }

  private isTwoFactorRequired(
    result: AuthTokensResult | TwoFactorRequiredResult,
  ): result is TwoFactorRequiredResult {
    return 'requiresTwoFactor' in result;
  }

  private toAuthResponse(result: AuthTokensResult): AuthResponseDto {
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      message: result.message,
      user: result.user,
    };
  }

  private logAuthClientIp(
    flow: string,
    req: Request,
    resolvedClientIp: string | null | undefined,
  ): void {
    this.logger.log({
      scope: 'auth_client_ip_received',
      flow,
      requestIp: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      forwardedFor: req.get('x-forwarded-for') ?? null,
      realIp: req.get('x-real-ip') ?? null,
      cloudflareConnectingIp: req.get('cf-connecting-ip') ?? null,
      resolvedClientIp: resolvedClientIp ?? null,
    });
  }

  private resolveClientIp(req: Request): string | undefined {
    const forwardedFor = req.get('x-forwarded-for');
    const realIp = req.get('x-real-ip');

    const resolvedClientIp =
      this.normalizeClientIpCandidate(forwardedFor?.split(',')[0] ?? null) ??
      this.normalizeClientIpCandidate(realIp ?? null) ??
      this.normalizeClientIpCandidate(req.ip ?? null);

    return resolvedClientIp ?? undefined;
  }

  private normalizeClientIpCandidate(value: string | null): string | null {
    const normalized = value?.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('::ffff:')) {
      return normalized.slice('::ffff:'.length);
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/u.test(normalized)) {
      return normalized.replace(/:\d+$/u, '');
    }

    if (/^\[[^\]]+\]:\d+$/u.test(normalized)) {
      return normalized.replace(/^\[([^\]]+)\]:\d+$/u, '$1');
    }

    return normalized;
  }

  private getRefreshTokenFromRequest(req: Request): string {
    const cookieName =
      this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME') ??
      'refresh_token';
    const cookies = req.headers.cookie;

    if (!cookies) {
      throw new UnauthorizedException('Missing refresh token cookie');
    }

    const cookieValue = cookies
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${cookieName}=`));

    if (!cookieValue) {
      throw new UnauthorizedException('Missing refresh token cookie');
    }

    return decodeURIComponent(cookieValue.slice(cookieName.length + 1));
  }

  private getTwoFactorTokenFromRequest(req: Request): string {
    const cookieName =
      this.configService.get<string>('AUTH_TWO_FACTOR_COOKIE_NAME') ??
      'two_factor_token';
    const cookies = req.headers.cookie;

    if (!cookies) {
      throw new UnauthorizedException('Missing two-factor token');
    }

    const cookieValue = cookies
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${cookieName}=`));

    if (!cookieValue) {
      throw new UnauthorizedException('Missing two-factor token');
    }

    return decodeURIComponent(cookieValue.slice(cookieName.length + 1));
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const cookieName =
      this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME') ??
      'refresh_token';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');

    res.cookie(cookieName, refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      domain: cookieDomain || undefined,
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_LIFETIME,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    const cookieName =
      this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME') ??
      'refresh_token';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');

    res.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      domain: cookieDomain || undefined,
      path: '/api/auth',
    });
  }

  private setTwoFactorTokenCookie(res: Response, twoFactorToken: string): void {
    const cookieName =
      this.configService.get<string>('AUTH_TWO_FACTOR_COOKIE_NAME') ??
      'two_factor_token';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');

    res.cookie(cookieName, twoFactorToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      domain: cookieDomain || undefined,
      path: '/api/auth',
      maxAge: 10 * 60 * 1000,
    });
  }

  private clearTwoFactorTokenCookie(res: Response): void {
    const cookieName =
      this.configService.get<string>('AUTH_TWO_FACTOR_COOKIE_NAME') ??
      'two_factor_token';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');

    res.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      domain: cookieDomain || undefined,
      path: '/api/auth',
    });
  }

  private getGoogleSuccessRedirectUrl(): string {
    return (
      this.configService.get<string>('GOOGLE_AUTH_SUCCESS_REDIRECT_URL') ??
      'http://localhost:3000/auth/success'
    );
  }

  private buildGoogleTwoFactorRedirectUrl(method: 'email' | 'totp'): string {
    const base =
      this.configService.get<string>('GOOGLE_AUTH_TWO_FACTOR_REDIRECT_URL') ??
      'http://localhost:3000/auth/two-factor';

    const url = new URL(base);
    url.searchParams.set('method', method);

    return url.toString();
  }
}
