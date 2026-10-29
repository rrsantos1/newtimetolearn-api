import { RoleCode } from "../../../users/types/RoleCode";
import { UserStatus } from "../../../users/types/UserStatus";

export interface LoginUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  roles: RoleCode[];
}

export interface ILoginRepository {
  findByEmail(email: string): Promise<LoginUserRecord | null>;
}