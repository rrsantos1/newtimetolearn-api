import { AppDataSource } from "../../../../shared/database/data-source";
import { Role } from "../../entities/Role";
import { IRoleRepository } from "../interfaces/IRoleRepository";
import { RoleCode } from "../../types/RoleCode";

export class RoleRepository implements IRoleRepository {
  private readonly repository = AppDataSource.getRepository(Role);

  async findByCode(code: RoleCode): Promise<Role | null> {
    return this.repository.findOne({
      where: { code },
    });
  }
}