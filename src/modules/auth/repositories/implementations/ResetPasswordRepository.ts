import type { EntityManager } from "typeorm";
import { User } from "../../../users/entities/User";
import { PasswordResetToken } from "../../entities/PasswordResetToken";
import { IResetPasswordRepository } from "../interfaces/IResetPasswordRepository";

export class ResetPasswordRepository
  implements IResetPasswordRepository
{
  async findTokenForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    return manager.getRepository(PasswordResetToken).findOne({
      where: { tokenHash },
      lock: { mode: "pessimistic_write" },
    });
  }

  async findUserForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null> {
    return manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: "pessimistic_write" },
    });
  }

  async saveUser(
    manager: EntityManager,
    user: User,
  ): Promise<User> {
    return manager.getRepository(User).save(user);
  }

  async saveToken(
    manager: EntityManager,
    token: PasswordResetToken,
  ): Promise<PasswordResetToken> {
    return manager.getRepository(PasswordResetToken).save(token);
  }

  async consumeAllTokens(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await manager
      .getRepository(PasswordResetToken)
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where("user_id = :userId", { userId })
      .andWhere("consumed_at IS NULL")
      .execute();
  }
}