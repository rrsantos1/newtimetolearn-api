import bcrypt from "bcryptjs";
import { AppDataSource } from "../../../shared/database/data-source";
import { UserStatus } from "../../users/types/UserStatus";
import { AuthError } from "../errors/AuthError";
import type { IChangePasswordRepository } from "../repositories/interfaces/IChangePasswordRepository";
import type { ChangePasswordInput } from "../schemas/changePasswordSchema";

export class ChangePasswordService {
  constructor(
    private readonly repository: IChangePasswordRepository,
  ) {}

  async execute(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const user = await this.repository.findUserByIdForUpdate(
        manager,
        userId,
      );

      if (!user) {
        throw new AuthError(
          "USER_NOT_FOUND",
          404,
          "Usuário não encontrado.",
        );
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new AuthError(
          "USER_NOT_ACTIVE",
          403,
          "Não é possível alterar a senha desta conta.",
        );
      }

      const currentPasswordMatches = await bcrypt.compare(
        input.currentPassword,
        user.passwordHash,
      );

      if (!currentPasswordMatches) {
        throw new AuthError(
          "INVALID_CURRENT_PASSWORD",
          400,
          "A senha atual está incorreta.",
        );
      }

      const newPasswordMatches = await bcrypt.compare(
        input.newPassword,
        user.passwordHash,
      );

      if (newPasswordMatches) {
        throw new AuthError(
          "PASSWORD_UNCHANGED",
          400,
          "A nova senha deve ser diferente da senha atual.",
        );
      }

      user.passwordHash = await bcrypt.hash(input.newPassword, 12);

      await this.repository.saveUser(manager, user);
    });
  }
}