import type { EntityManager } from "typeorm";
import { EmailVerificationToken } from "../../../users/entities/EmailVerificationToken";
import { User } from "../../../users/entities/User";

export interface IEmailVerificationRepository {
  findTokenForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<EmailVerificationToken | null>;

  findUserForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null>;

  saveUser(manager: EntityManager, user: User): Promise<User>;

  saveToken(
    manager: EntityManager,
    token: EmailVerificationToken,
  ): Promise<EmailVerificationToken>;

  findTokenByHash(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<EmailVerificationToken | null>;
}