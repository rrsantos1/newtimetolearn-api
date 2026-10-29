import { AppDataSource } from "../../../shared/database/data-source";
import { UserStatus } from "../../users/types/UserStatus";
import { AuthError } from "../errors/AuthError";
import type { IEmailVerificationRepository } from "../repositories/interfaces/IEmailVerificationRepository";
import { EmailVerificationTokenService } from "./EmailVerificationTokenService";

export class VerifyEmailService {
  constructor(
    private readonly repository: IEmailVerificationRepository,
    private readonly tokenService: EmailVerificationTokenService,
  ) {}

  async execute(token: string): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hash(token);

    await AppDataSource.transaction(async (manager) => {
      const tokenCandidate = await this.repository.findTokenByHash(
        manager,
        tokenHash,
      );

      if (!tokenCandidate) {
        throw new AuthError(
            "INVALID_OR_EXPIRED_TOKEN",
            400,
            "O link de confirmação é inválido ou expirou.",
        );
      }

      const user = await this.repository.findUserForUpdate(
        manager,
        tokenCandidate.userId,
      );

     const verificationToken = await this.repository.findTokenForUpdate(
        manager,
        tokenHash,
     );

     if (
        !user ||
        !verificationToken ||
        verificationToken.userId !== user.id ||
        verificationToken.consumedAt !== null ||
        verificationToken.expiresAt.getTime() <= Date.now() ||
        user.status !== UserStatus.PENDING_VERIFICATION
     ) {
        throw new AuthError(
            "INVALID_OR_EXPIRED_TOKEN",
            400,
            "O link de confirmação é inválido ou expirou.",
        );
      }

      const now = new Date();

      user.status = UserStatus.ACTIVE;
      user.emailVerifiedAt = now;
      verificationToken.consumedAt = now;

      await this.repository.saveUser(manager, user);
      await this.repository.saveToken(manager, verificationToken);
    });

    return {
      message: "E-mail confirmado. Sua conta está ativa.",
    };
  }
}