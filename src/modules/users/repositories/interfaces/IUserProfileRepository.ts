import type { RoleCode } from "../../types/RoleCode";
import type { UserStatus } from "../../types/UserStatus";

export interface UserProfileRecord {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  roles: RoleCode[];
}

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfileRecord | null>;
}