import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const port = configService.get<number>('MAIL_PORT', 1025);
        const secure = configService.get<boolean>('MAIL_SECURE', false);
        const user = configService.get<string>('MAIL_USER');
        const pass = configService.get<string>('MAIL_PASSWORD');

        return {
          transport: {
            host: configService.get<string>('MAIL_HOST', 'localhost'),
            port,
            secure,
            auth: user && pass ? { user, pass } : undefined,
          },
          defaults: {
            from: configService.get<string>(
              'MAIL_FROM',
              '"TradeMatrix" <no-reply@example.com>',
            ),
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
