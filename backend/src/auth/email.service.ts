import { Injectable } from "@nestjs/common";

@Injectable()
export class EmailService {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    console.log(`[EMAIL MOCK] Codigo para ${email}: ${code}.`);
  }
}
