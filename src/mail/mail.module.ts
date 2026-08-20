import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

function parseBooleanEnv(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === 'true';
}

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const port = configService.get<number>('MAIL_PORT', 1025);
        const secure = parseBooleanEnv(
          configService.get<string | boolean>('MAIL_SECURE', false),
        );
        const user = configService.get<string>('MAIL_USER');
        const pass = configService.get<string>('MAIL_PASSWORD');
        const from = configService.get<string>(
          'MAIL_FROM',
          '"TradeMatrix" <no-reply@example.com>',
        );
        const replyTo = configService.get<string>('MAIL_REPLY_TO');

        return {
          transport: {
            host: configService.get<string>('MAIL_HOST', 'localhost'),
            port,
            secure,
            auth: user && pass ? { user, pass } : undefined,
          },
          defaults: {
            from,
            replyTo: replyTo || undefined,
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
