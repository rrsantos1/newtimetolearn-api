import type { EntityManager } from "typeorm";
import type { User } from "../../../users/entities/User";

export interface IChangePasswordRepository {
  findUserByIdForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null>;

  saveUser(
    manager: EntityManager,
    user: User,
  ): Promise<User>;
}