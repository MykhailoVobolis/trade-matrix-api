import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

type GenerateTotpSetupInput = {
  issuer: string;
  accountName: string;
};

type GenerateTotpSetupResult = {
  secret: string;
  otpauthUrl: string;
};

@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  generateSetup(input: GenerateTotpSetupInput): GenerateTotpSetupResult {
    const secret = this.generateSecret();

    return {
      secret,
      otpauthUrl: authenticator.keyuri(input.accountName, input.issuer, secret),
    };
  }

  verifyCode(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) {
      return false;
    }

    authenticator.options = {
      digits: 6,
      step: 30,
      window: 1,
    };

    return authenticator.verify({
      token: code,
      secret,
    });
  }
}
