import type { EntityManager } from "typeorm";
import type { EmailVerificationToken } from "../../../users/entities/EmailVerificationToken";
import type { Role } from "../../../users/entities/Role";
import type { User } from "../../../users/entities/User";
import type { RoleCode } from "../../../users/types/RoleCode";
import type { UserStatus } from "../../../users/types/UserStatus";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}

export interface CreateVerificationTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface IRegisterRepository {
  findUserByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<User | null>;

  findRoleByCode(
    manager: EntityManager,
    code: RoleCode,
  ): Promise<Role | null>;

  createUser(
    manager: EntityManager,
    data: CreateUserData,
  ): Promise<User>;

  assignRole(
    manager: EntityManager,
    userId: string,
    roleId: string,
  ): Promise<void>;

  createVerificationToken(
    manager: EntityManager,
    data: CreateVerificationTokenData,
  ): Promise<EmailVerificationToken>;
}