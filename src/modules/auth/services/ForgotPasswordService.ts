import { AppDataSource } from "../../../shared/database/data-source";
import { EmailService } from "../../../shared/email/EmailService";
import type { IForgotPasswordRepository } from "../repositories/interfaces/IForgotPasswordRepository";
import { PasswordResetTokenService } from "./PasswordResetTokenService";

export class ForgotPasswordService {
  constructor(
    private readonly repository: IForgotPasswordRepository,
    private readonly emailService: EmailService,
    private readonly tokenService: PasswordResetTokenService,
    private readonly onEmailError: (error: unknown) => void,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await AppDataSource.transaction(async (manager) => {
      const foundUser = await this.repository.findUserByEmail(
        manager,
        email,
      );

      if (!foundUser || foundUser.status !== "ACTIVE") {
        return null;
      }

      const generated = this.tokenService.generate();

      const createdToken = await this.repository.createToken(manager, {
        userId: foundUser.id,
        tokenHash: generated.tokenHash,
        expiresAt: generated.expiresAt,
      });

      return {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        token: generated.token,
        tokenId: createdToken.id,
      };
    });

    if (!user) {
      return;
    }

    try {
      await this.emailService.sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        token: user.token,
      });
    } catch (error: unknown) {
      this.onEmailError(error);

      await AppDataSource.transaction(async (manager) => {
        const repository = manager.getRepository("password_reset_tokens");

        await repository.delete({
          id: user.tokenId,
        });
      });

      return;
    }

    await AppDataSource.transaction(async (manager) => {
      await this.repository.consumePreviousTokens(
        manager,
        user.id,
        user.tokenId,
      );
    });
  }
}