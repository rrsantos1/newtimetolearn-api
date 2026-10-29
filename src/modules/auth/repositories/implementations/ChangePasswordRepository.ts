import type { EntityManager } from "typeorm";
import { User } from "../../../users/entities/User";
import type { IChangePasswordRepository } from "../interfaces/IChangePasswordRepository";

export class ChangePasswordRepository
  implements IChangePasswordRepository
{
  async findUserByIdForUpdate(
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
}