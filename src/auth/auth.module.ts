import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ACCESS_TOKEN_LIFETIME } from '../constants';
import { GeoLocationModule } from '../geolocation/geo-location.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TotpService } from './totp.service';

@Module({
  imports: [
    ConfigModule,
    GeoLocationModule,
    MailModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: Math.floor(ACCESS_TOKEN_LIFETIME / 1000),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    GoogleAuthGuard,
    JwtAuthGuard,
    LocalAuthGuard,
    RolesGuard,
    GoogleStrategy,
    JwtStrategy,
    LocalStrategy,
    TotpService,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PassportModule, JwtModule],
})
export class AuthModule {}
