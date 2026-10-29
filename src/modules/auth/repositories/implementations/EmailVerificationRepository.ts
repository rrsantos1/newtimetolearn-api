import type { EntityManager } from "typeorm";
import type { IEmailVerificationRepository } from "../interfaces/IEmailVerificationRepository";
import { EmailVerificationToken } from "../../../users/entities/EmailVerificationToken";
import { User } from "../../../users/entities/User";

export class EmailVerificationRepository
  implements IEmailVerificationRepository
{
  async findTokenForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<EmailVerificationToken | null> {
    return manager
      .getRepository(EmailVerificationToken)
      .createQueryBuilder("token")
      .setLock("pessimistic_write")
      .where("token.tokenHash = :tokenHash", { tokenHash })
      .getOne();
  }

  async findUserForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder("user")
      .setLock("pessimistic_write")
      .where("user.id = :userId", { userId })
      .getOne();
  }

  async saveUser(
    manager: EntityManager,
    user: User,
  ): Promise<User> {
    return manager.getRepository(User).save(user);
  }

  async saveToken(
    manager: EntityManager,
    token: EmailVerificationToken,
  ): Promise<EmailVerificationToken> {
    return manager.getRepository(EmailVerificationToken).save(token);
  }

  async findTokenByHash(
    manager: EntityManager,
    tokenHash: string,
    ): Promise<EmailVerificationToken | null> {
    return manager.getRepository(EmailVerificationToken).findOne({
        where: { tokenHash },
    });
  }
}