import { ResetPasswordService } from "../services/ResetPasswordService";
import { PasswordResetTokenService } from "../services/PasswordResetTokenService";
import { ResetPasswordRepository } from "../repositories/implementations/ResetPasswordRepository";

export function makeResetPasswordService(): ResetPasswordService {
  return new ResetPasswordService(
    new ResetPasswordRepository(),
    new PasswordResetTokenService(),
  );
}