import { AppDataSource } from "../../../shared/database/data-source";
import { isUniqueConstraintViolation } from "../../../shared/database/isUniqueConstraintViolation";
import { AuthError } from "../errors/AuthError";
import type { ConfirmEmailChangeResult, IEmailChangeRepository } from "../repositories/interfaces/IEmailChangeRepository";
import type { ConfirmEmailChangeInput } from "../schemas/confirmEmailChangeSchema";
import { PasswordResetTokenService } from "./PasswordResetTokenService";

export class ConfirmEmailChangeService {
  constructor(
    private readonly repository: IEmailChangeRepository,
    private readonly tokenService: PasswordResetTokenService,
  ) {}

  async execute(
    userId: string,
    input: ConfirmEmailChangeInput,
  ): Promise<{ message: string }> {
    let result: ConfirmEmailChangeResult;

    try {
    result = await AppDataSource.transaction((manager) =>
        this.repository.confirmEmailChange(
        manager,
        userId,
        this.tokenService.hash(input.token),
        ),
    );
    } catch (error: unknown) {
        if (isUniqueConstraintViolation(error, "uq_users_email")) {
            throw new AuthError(
            "EMAIL_ALREADY_IN_USE",
            409,
            "Este e-mail já está cadastrado.",
            );
        }

        throw error;
    }

    switch (result) {
      case "CONFIRMED":
        return { message: "E-mail alterado com sucesso." };

      case "USER_NOT_FOUND":
        throw new AuthError(
          "USER_NOT_FOUND",
          404,
          "Usuário não encontrado.",
        );

      case "USER_NOT_ACTIVE":
        throw new AuthError(
          "USER_NOT_ACTIVE",
          403,
          "A conta não está ativa.",
        );

      case "EMAIL_ALREADY_IN_USE":
        throw new AuthError(
          "EMAIL_ALREADY_IN_USE",
          409,
          "Este e-mail já está cadastrado.",
        );

      case "INVALID_TOKEN":
        throw new AuthError(
          "INVALID_EMAIL_CHANGE_TOKEN",
          400,
          "Token inválido ou expirado.",
        );
    }
  }
}