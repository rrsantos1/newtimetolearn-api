import { AppDataSource } from "../../../../shared/database/data-source";
import { User } from "../../entities/User";
import { IUserRepository } from "../interfaces/IUserRepository";

export class UserRepository implements IUserRepository {
  private readonly repository = AppDataSource.getRepository(User);

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        userRoles: {
          role: true,
        },
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: {
        userRoles: {
          role: true,
        },
      },
    });
  }
}