import type { EntityManager } from "typeorm";
import type { User } from "../../../users/entities/User";
import type { PasswordResetToken } from "../../entities/PasswordResetToken";

export interface IResetPasswordRepository {
  findTokenForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<PasswordResetToken | null>;

  findUserForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null>;

  saveUser(
    manager: EntityManager,
    user: User,
  ): Promise<User>;

  saveToken(
    manager: EntityManager,
    token: PasswordResetToken,
  ): Promise<PasswordResetToken>;

  consumeAllTokens(
    manager: EntityManager,
    userId: string,
  ): Promise<void>;
}