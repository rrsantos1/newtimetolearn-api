import bcrypt from "bcryptjs";
import { AppDataSource } from "../../../shared/database/data-source";
import { AuthError } from "../errors/AuthError";
import type { IResetPasswordRepository } from "../repositories/interfaces/IResetPasswordRepository";
import { PasswordResetTokenService } from "./PasswordResetTokenService";

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export class ResetPasswordService {
  constructor(
    private readonly repository: IResetPasswordRepository,
    private readonly tokenService: PasswordResetTokenService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = this.tokenService.hash(input.token);
    const passwordHash = await bcrypt.hash(input.password, 12);

    await AppDataSource.transaction(async (manager) => {
      const resetToken = await this.repository.findTokenForUpdate(
        manager,
        tokenHash,
      );

      if (
        !resetToken ||
        resetToken.consumedAt !== null ||
        resetToken.expiresAt.getTime() <= Date.now()
      ) {
        throw new AuthError(
          "INVALID_RESET_TOKEN",
          400,
          "Token de recuperação inválido ou expirado.",
        );
      }

      const user = await this.repository.findUserForUpdate(
        manager,
        resetToken.userId,
      );

      if (!user || user.status !== "ACTIVE") {
        throw new AuthError(
          "INVALID_RESET_TOKEN",
          400,
          "Token de recuperação inválido ou expirado.",
        );
      }

      user.passwordHash = passwordHash;
      await this.repository.saveUser(manager, user);

      resetToken.consumedAt = new Date();
      await this.repository.saveToken(manager, resetToken);

      await this.repository.consumeAllTokens(manager, user.id);
    });
  }
}