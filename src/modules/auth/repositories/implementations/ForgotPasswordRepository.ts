import type { EntityManager } from "typeorm";
import { User } from "../../../users/entities/User";
import { PasswordResetToken } from "../../entities/PasswordResetToken";
import { IForgotPasswordRepository, CreatePasswordResetTokenData } from "../interfaces/IForgotPasswordRepository";

export class ForgotPasswordRepository
  implements IForgotPasswordRepository
{
  async findUserByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<User | null> {
    return manager.getRepository(User).findOne({
      where: { email },
    });
  }

  async createToken(
    manager: EntityManager,
    data: CreatePasswordResetTokenData,
  ): Promise<PasswordResetToken> {
    const repository = manager.getRepository(PasswordResetToken);
    const token = repository.create(data);

    return repository.save(token);
  }

  async consumePreviousTokens(
    manager: EntityManager,
    userId: string,
    exceptTokenId: string,
  ): Promise<void> {
    await manager
      .getRepository(PasswordResetToken)
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where("user_id = :userId", { userId })
      .andWhere("consumed_at IS NULL")
      .andWhere("id <> :exceptTokenId", { exceptTokenId })
      .execute();
  }
}