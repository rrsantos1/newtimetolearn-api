
import { AppDataSource } from "../../../shared/database/data-source";
import { EmailService } from "../../../shared/email/EmailService";
import { UserStatus } from "../../users/types/UserStatus";
import type { IResendVerificationRepository } from "../repositories/interfaces/IResendVerificationRepository";
import { EmailVerificationTokenService } from "./EmailVerificationTokenService";

const RESEND_COOLDOWN_MS = 60_000;

interface PendingEmail {
  userId: string;
  email: string;
  name: string;
  token: string;
  tokenRecordId: string;
}

export class ResendVerificationService {
  constructor(
    private readonly repository: IResendVerificationRepository,
    private readonly emailService: EmailService,
    private readonly tokenService: EmailVerificationTokenService,
    private readonly onEmailError: (error: unknown) => void,
  ) {}

  async execute(email: string): Promise<{ message: string }> {
    const generatedToken = this.tokenService.generate();

    const pending = await AppDataSource.transaction(async (manager) => {
      const user = await this.repository.findUserByEmailForUpdate(
        manager,
        email,
      );

      if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
        return null;
      }

      const existingTokens =
        await this.repository.findTokensByUserIdForUpdate(manager, user.id);

      const latestToken = existingTokens[0];

      if (
        latestToken &&
        Date.now() - latestToken.createdAt.getTime() < RESEND_COOLDOWN_MS
      ) {
        return null;
      }

      const tokenRecord = await this.repository.createToken(manager, {
        userId: user.id,
        tokenHash: generatedToken.tokenHash,
        expiresAt: generatedToken.expiresAt,
      });

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        token: generatedToken.token,
        tokenRecordId: tokenRecord.id,
      } satisfies PendingEmail;
    });

    if (pending) {
      try {
        await this.emailService.sendVerificationEmail({
          email: pending.email,
          name: pending.name,
          token: pending.token,
        });
      } catch (error: unknown) {
        await this.removeCandidateToken(pending);
        this.onEmailError(error);

        return this.genericResponse();
      }

      await AppDataSource.transaction(async (manager) => {
        const user = await this.repository.findUserByEmailForUpdate(
          manager,
          pending.email,
        );

        if (user?.status === UserStatus.PENDING_VERIFICATION) {
          await this.repository.consumePreviousTokens(
            manager,
            pending.userId,
            pending.tokenRecordId,
          );
        } else {
          const candidate = await this.repository.findTokensByUserIdForUpdate(
            manager,
            pending.userId,
          );

          const candidateToken = candidate.find(
            (item) => item.id === pending.tokenRecordId,
          );

          if (candidateToken) {
            await this.repository.deleteToken(manager, candidateToken);
          }
        }
      });
    }

    return this.genericResponse();
  }

  private async removeCandidateToken(pending: PendingEmail): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const tokens = await this.repository.findTokensByUserIdForUpdate(
        manager,
        pending.userId,
      );

      const candidate = tokens.find(
        (item) => item.id === pending.tokenRecordId,
      );

      if (candidate) {
        await this.repository.deleteToken(manager, candidate);
      }
    });
  }

  private genericResponse(): { message: string } {
    return {
      message:
        "Se houver uma conta pendente para esse endereço, você receberá um e-mail com as instruções.",
    };
  }
}