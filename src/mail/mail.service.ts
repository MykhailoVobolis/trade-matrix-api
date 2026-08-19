import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationCode(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
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
        background-color: #f9f9f9;
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
    await this.mailerService.sendMail({
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
        background-color: #f9f9f9;
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
    await this.mailerService.sendMail({
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
        background-color: #f9f9f9;
        width: fit-content;
        margin: 20px auto;
      ">
        ${verificationCode}
      </div>
      <p style="color: #666;">This code expires in 10 minutes.</p>
    `,
    });
  }
}
