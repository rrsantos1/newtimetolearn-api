import { EmailService } from "../../../shared/email/EmailService";
import { RegisterRepository } from "../repositories/implementations/RegisterRepository";
import { RegisterService } from "../services/RegisterService";
import { EmailVerificationTokenService } from "../services/EmailVerificationTokenService";

export function makeRegisterService(): RegisterService {
  return new RegisterService(
    new RegisterRepository(),
    new EmailService(),
    new EmailVerificationTokenService(),
  );
}