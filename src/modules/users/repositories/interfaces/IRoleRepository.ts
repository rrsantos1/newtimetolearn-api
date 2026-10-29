import { Role } from "../../entities/Role";
import { RoleCode } from "../../types/RoleCode";

export interface IRoleRepository {
  findByCode(code: RoleCode): Promise<Role | null>;
}