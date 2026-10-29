import type { EntityManager } from "typeorm";
import type { EmailVerificationToken } from "../../../users/entities/EmailVerificationToken";
import type { User } from "../../../users/entities/User";

export interface ResendTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface IResendVerificationRepository {
  findUserByEmailForUpdate(
    manager: EntityManager,
    email: string,
  ): Promise<User | null>;

  findTokensByUserIdForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailVerificationToken[]>;

  createToken(
    manager: EntityManager,
    data: ResendTokenData,
  ): Promise<EmailVerificationToken>;

  deleteToken(
    manager: EntityManager,
    token: EmailVerificationToken,
  ): Promise<void>;

  consumePreviousTokens(
    manager: EntityManager,
    userId: string,
    exceptTokenId: string,
  ): Promise<void>;
}