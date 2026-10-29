import bcrypt from "bcryptjs";
import { AppDataSource } from "../../../shared/database/data-source";
import { EmailService } from "../../../shared/email/EmailService";
import { AuthError } from "../errors/AuthError";
import type { IEmailChangeRepository } from "../repositories/interfaces/IEmailChangeRepository";
import type { RequestEmailChangeInput } from "../schemas/requestEmailChangeSchema";
import { PasswordResetTokenService } from "./PasswordResetTokenService";

const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

export class RequestEmailChangeService {
  constructor(
    private readonly repository: IEmailChangeRepository,
    private readonly emailService: EmailService,
    private readonly tokenService: PasswordResetTokenService,
  ) {}

  async execute(
    userId: string,
    input: RequestEmailChangeInput,
  ): Promise<{ message: string }> {
    const requestData = await AppDataSource.transaction(async (manager) => {
      const user = await this.repository.findUserByIdForUpdate(
        manager,
        userId,
      );

      if (!user) {
        throw new AuthError("USER_NOT_FOUND", 404, "Usuário não encontrado.");
      }

      if (user.status !== "ACTIVE") {
        throw new AuthError(
          "USER_NOT_ACTIVE",
          403,
          "A conta não está ativa.",
        );
      }

      const passwordIsValid = await bcrypt.compare(
        input.currentPassword,
        user.passwordHash,
      );

      if (!passwordIsValid) {
        throw new AuthError(
          "INVALID_PASSWORD",
          400,
          "Senha atual inválida.",
        );
      }

      if (user.email.toLowerCase() === input.newEmail) {
        throw new AuthError(
          "EMAIL_UNCHANGED",
          400,
          "O novo e-mail deve ser diferente do atual.",
        );
      }

      const existingUser = await this.repository.findUserByEmail(
        manager,
        input.newEmail,
      );

      if (existingUser) {
        throw new AuthError(
          "EMAIL_ALREADY_IN_USE",
          409,
          "Este e-mail já está cadastrado.",
        );
      }

      const generated = this.tokenService.generate();

      const createdRequest = await this.repository.createRequest(manager, {
        userId,
        newEmail: input.newEmail,
        tokenHash: generated.tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRATION_MS),
      });

      return {
        userId,
        requestId: createdRequest.id,
        email: input.newEmail,
        name: user.name,
        token: generated.token,
      };
    });

    try {
      await this.emailService.sendEmailChangeVerification({
        email: requestData.email,
        name: requestData.name,
        token: requestData.token,
      });
    } catch {
      await AppDataSource.transaction(async (manager) => {
        await this.repository.deleteRequest(
          manager,
          requestData.requestId,
        );
      });

      throw new AuthError(
        "EMAIL_SEND_FAILED",
        503,
        "Não foi possível enviar o e-mail de confirmação.",
      );
    }

    await AppDataSource.transaction(async (manager) => {
        const user = await this.repository.findUserByIdForUpdate(
            manager,
            requestData.userId,
        );

        if (!user || user.status !== "ACTIVE") {
            await this.repository.deleteRequest(manager, requestData.requestId);
            return;
        }

        const sentAt = new Date();

        await this.repository.markRequestAsSent(
            manager,
            requestData.requestId,
            sentAt,
        );

        const latestRequest =
            await this.repository.findLatestSentRequestForUpdate(
            manager,
            requestData.userId,
            );

        if (!latestRequest) {
            await this.repository.deleteRequest(manager, requestData.requestId);
            return;
        }

        await this.repository.consumePreviousRequests(
            manager,
            requestData.userId,
            latestRequest.id,
            sentAt,
        );
    });

    return {
      message:
        "Se a solicitação foi aceita, você receberá um e-mail de confirmação.",
    };
  }
}