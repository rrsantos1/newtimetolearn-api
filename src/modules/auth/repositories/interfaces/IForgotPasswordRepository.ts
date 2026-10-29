import type { EntityManager } from "typeorm";
import type { User } from "../../../users/entities/User";
import type { PasswordResetToken } from "../../entities/PasswordResetToken";

export interface CreatePasswordResetTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface IForgotPasswordRepository {
  findUserByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<User | null>;

  createToken(
    manager: EntityManager,
    data: CreatePasswordResetTokenData,
  ): Promise<PasswordResetToken>;

  consumePreviousTokens(
    manager: EntityManager,
    userId: string,
    exceptTokenId: string,
  ): Promise<void>;
}