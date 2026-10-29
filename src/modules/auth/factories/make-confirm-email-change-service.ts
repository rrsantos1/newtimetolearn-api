import { EmailChangeRepository } from "../repositories/implementations/EmailChangeRepository";
import { ConfirmEmailChangeService } from "../services/ConfirmEmailChangeService";
import { PasswordResetTokenService } from "../services/PasswordResetTokenService";

export function makeConfirmEmailChangeService(): ConfirmEmailChangeService {
  return new ConfirmEmailChangeService(
    new EmailChangeRepository(),
    new PasswordResetTokenService(),
  );
}