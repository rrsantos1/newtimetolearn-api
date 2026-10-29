import { EmailService } from "../../../shared/email/EmailService";
import { ForgotPasswordRepository } from "../repositories/implementations/ForgotPasswordRepository";
import { ForgotPasswordService } from "../services/ForgotPasswordService";
import { PasswordResetTokenService } from "../services/PasswordResetTokenService";

export function makeForgotPasswordService(
  onEmailError: (error: unknown) => void,
): ForgotPasswordService {
  return new ForgotPasswordService(
    new ForgotPasswordRepository(),
    new EmailService(),
    new PasswordResetTokenService(),
    onEmailError,
  );
}