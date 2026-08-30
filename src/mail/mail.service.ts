import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type ParsedMailbox = {
  email: string;
  name?: string;
};

type BrevoErrorResponse = {
  code?: string;
  message?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCode(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    await this.sendTransactionalEmail({
      to: email,
      subject: 'Your verification code',
      text: `Your verification code is ${verificationCode}. It expires in 10 minutes.`,
      html: `
      <p>Hello,</p>
      <p>Use the code below to continue:</p>
      <div style="
        font-size: 40px;
        font-weight: bold;
        letter-spacing: 6px;
        text-align: center;
        padding: 20px;
        border: 1px solid #eee;
        border-radius: 8px;
        background-color: #dbeafe;
        color: #0f274d;
        width: fit-content;
        margin: 20px auto;
      ">
        ${verificationCode}
      </div>
      <p style="color: #666;">This code expires in 10 minutes.</p>
    `,
    });
  }

  async sendPasswordResetCode(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    await this.sendTransactionalEmail({
      to: email,
      subject: 'Your password reset code',
      text: `Your password reset code is ${verificationCode}. It expires in 10 minutes.`,
      html: `
      <p>Hello,</p>
      <p>Use the code below to continue:</p>
      <div style="
        font-size: 40px;
        font-weight: bold;
        letter-spacing: 6px;
        text-align: center;
        padding: 20px;
        border: 1px solid #eee;
        border-radius: 8px;
        background-color: #dbeafe;
        color: #0f274d;
        width: fit-content;
        margin: 20px auto;
      ">
        ${verificationCode}
      </div>
      <p style="color: #666;">This code expires in 10 minutes.</p>
    `,
    });
  }

  async sendTwoFactorCode(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    await this.sendTransactionalEmail({
      to: email,
      subject: 'Your two-factor authentication code',
      text: `Your two-factor authentication code is ${verificationCode}. It expires in 10 minutes.`,
      html: `
      <p>Hello,</p>
      <p>Use the code below to complete your sign in:</p>
      <div style="
        font-size: 40px;
        font-weight: bold;
        letter-spacing: 6px;
        text-align: center;
        padding: 20px;
        border: 1px solid #eee;
        border-radius: 8px;
        background-color: #dbeafe;
        color: #0f274d;
        width: fit-content;
        margin: 20px auto;
      ">
        ${verificationCode}
      </div>
      <p style="color: #666;">This code expires in 10 minutes.</p>
    `,
    });
  }

  private async sendTransactionalEmail(content: MailContent): Promise<void> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'Brevo API key is not configured.',
      );
    }

    const sender = this.parseMailbox(
      this.configService.get<string>(
        'MAIL_FROM',
        '"TradeMatrix" <no-reply@example.com>',
      ),
      'MAIL_FROM',
    );
    const replyToValue = this.configService.get<string>('MAIL_REPLY_TO');
    const replyTo = replyToValue
      ? this.parseMailbox(replyToValue, 'MAIL_REPLY_TO')
      : undefined;

    let response: Response;

    try {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: content.to }],
          replyTo,
          subject: content.subject,
          textContent: content.text,
          htmlContent: content.html,
        }),
      });
    } catch (error) {
      this.logger.error('Brevo email request failed.', error);
      throw new ServiceUnavailableException(
        'Email service is temporarily unavailable.',
      );
    }

    if (response.ok) {
      return;
    }

    const errorPayload = await this.readBrevoErrorResponse(response);

    this.logger.error('Brevo email request was rejected.', {
      status: response.status,
      code: errorPayload.code ?? null,
      message: errorPayload.message ?? null,
    });

    if (response.status === 429) {
      throw new HttpException(
        'Email service is rate-limited. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (response.status >= 500) {
      throw new ServiceUnavailableException(
        'Email service is temporarily unavailable.',
      );
    }

    if (response.status >= 400) {
      throw new BadGatewayException('Email service rejected the request.');
    }

    throw new ServiceUnavailableException(
      'Email service is temporarily unavailable.',
    );
  }

  private parseMailbox(value: string, envName: string): ParsedMailbox {
    const trimmed = value.trim();
    const match = trimmed.match(/^(?:(.+?)\s*)?<([^<>@\s]+@[^<>@\s]+)>$/u);

    if (match) {
      const name = match[1]?.trim().replace(/^"(.*)"$/u, '$1');
      return {
        email: match[2].trim(),
        name: name || undefined,
      };
    }

    if (this.isEmail(trimmed)) {
      return { email: trimmed };
    }

    throw new InternalServerErrorException(
      `${envName} must be a valid email or "Name <email>" value.`,
    );
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
  }

  private async readBrevoErrorResponse(
    response: Response,
  ): Promise<BrevoErrorResponse> {
    try {
      const payload = (await response.json()) as BrevoErrorResponse;

      return {
        code: typeof payload.code === 'string' ? payload.code : undefined,
        message:
          typeof payload.message === 'string' ? payload.message : undefined,
      };
    } catch {
      return {};
    }
  }
}
