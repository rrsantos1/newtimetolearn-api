import type { EntityManager } from "typeorm";
import { EmailVerificationToken } from "../../../users/entities/EmailVerificationToken";
import { Role } from "../../../users/entities/Role";
import { User } from "../../../users/entities/User";
import { UserRole } from "../../../users/entities/UserRole";
import type { RoleCode } from "../../../users/types/RoleCode";
import type {
  CreateUserData,
  CreateVerificationTokenData,
  IRegisterRepository,
} from "../interfaces/IRegisterRepository";

export class RegisterRepository implements IRegisterRepository {
  async findUserByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<User | null> {
    return manager.getRepository(User).findOne({
      where: { email },
    });
  }

  async findRoleByCode(
    manager: EntityManager,
    code: RoleCode,
  ): Promise<Role | null> {
    return manager.getRepository(Role).findOne({
      where: { code },
    });
  }

  async createUser(
    manager: EntityManager,
    data: CreateUserData,
  ): Promise<User> {
    const repository = manager.getRepository(User);
    const user = repository.create(data);

    return repository.save(user);
  }

  async assignRole(
    manager: EntityManager,
    userId: string,
    roleId: string,
  ): Promise<void> {
    const repository = manager.getRepository(UserRole);
    const userRole = repository.create({ userId, roleId });

    await repository.save(userRole);
  }

  async createVerificationToken(
    manager: EntityManager,
    data: CreateVerificationTokenData,
  ): Promise<EmailVerificationToken> {
    const repository = manager.getRepository(EmailVerificationToken);
    const token = repository.create(data);

    return repository.save(token);
  }
}