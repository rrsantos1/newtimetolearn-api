import { EmailService } from "../../../shared/email/EmailService";
import { ResendVerificationRepository } from "../repositories/implementations/ResendVerificationRepository";
import { ResendVerificationService } from "../services/ResendVerificationService";
import { EmailVerificationTokenService } from "../services/EmailVerificationTokenService";

export function makeResendVerificationService(
  onEmailError: (error: unknown) => void,
): ResendVerificationService {
  return new ResendVerificationService(
    new ResendVerificationRepository(),
    new EmailService(),
    new EmailVerificationTokenService(),
    onEmailError,
  );
}