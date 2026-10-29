import type { EntityManager } from "typeorm";
import { EmailVerificationToken } from "../../../users/entities/EmailVerificationToken";
import { User } from "../../../users/entities/User";
import type {
  IResendVerificationRepository,
  ResendTokenData,
} from "../interfaces/IResendVerificationRepository";

export class ResendVerificationRepository
  implements IResendVerificationRepository
{
  async findUserByEmailForUpdate(
    manager: EntityManager,
    email: string,
  ): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder("user")
      .setLock("pessimistic_write")
      .where("user.email = :email", { email })
      .getOne();
  }

  async findTokensByUserIdForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailVerificationToken[]> {
    return manager
      .getRepository(EmailVerificationToken)
      .createQueryBuilder("token")
      .setLock("pessimistic_write")
      .where("token.userId = :userId", { userId })
      .orderBy("token.createdAt", "DESC")
      .getMany();
  }

  async createToken(
    manager: EntityManager,
    data: ResendTokenData,
  ): Promise<EmailVerificationToken> {
    const repository = manager.getRepository(EmailVerificationToken);

    return repository.save(
      repository.create({
        ...data,
        consumedAt: null,
      }),
    );
  }

  async deleteToken(
    manager: EntityManager,
    token: EmailVerificationToken,
  ): Promise<void> {
    await manager.getRepository(EmailVerificationToken).remove(token);
  }

  async consumePreviousTokens(
    manager: EntityManager,
    userId: string,
    exceptTokenId: string,
  ): Promise<void> {
    await manager
      .getRepository(EmailVerificationToken)
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where("user_id = :userId", { userId })
      .andWhere("id != :exceptTokenId", { exceptTokenId })
      .andWhere("consumed_at IS NULL")
      .execute();
  }
}