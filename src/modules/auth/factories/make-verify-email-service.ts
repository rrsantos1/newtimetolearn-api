import { EmailVerificationRepository } from "../repositories/implementations/EmailVerificationRepository";
import { EmailVerificationTokenService } from "../services/EmailVerificationTokenService";
import { VerifyEmailService } from "../services/VerifyEmailService";

export function makeVerifyEmailService(): VerifyEmailService {
  return new VerifyEmailService(
    new EmailVerificationRepository(),
    new EmailVerificationTokenService(),
  );
}