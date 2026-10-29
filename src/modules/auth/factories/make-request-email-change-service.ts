import { EmailService } from "../../../shared/email/EmailService";
import { EmailChangeRepository } from "../repositories/implementations/EmailChangeRepository";
import { PasswordResetTokenService } from "../services/PasswordResetTokenService";
import { RequestEmailChangeService } from "../services/RequestEmailChangeService";

export function makeRequestEmailChangeService(): RequestEmailChangeService {
  return new RequestEmailChangeService(
    new EmailChangeRepository(),
    new EmailService(),
    new PasswordResetTokenService(),
  );
}