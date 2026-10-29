import { ChangePasswordRepository } from "../repositories/implementations/ChangePasswordRepository";
import { ChangePasswordService } from "../services/ChangePasswordService";

export function makeChangePasswordService(): ChangePasswordService {
  return new ChangePasswordService(
    new ChangePasswordRepository(),
  );
}