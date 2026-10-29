import { AppDataSource } from "../../../../shared/database/data-source";
import { User } from "../../entities/User";
import { IUpdateUserProfileRepository } from "../interfaces/IUpdateUserProfileRepository";

export class UpdateUserProfileRepository
  implements IUpdateUserProfileRepository
{
  async findById(id: string): Promise<User | null> {
    return AppDataSource.getRepository(User).findOneBy({ id });
  }

  async save(user: User): Promise<User> {
    return AppDataSource.getRepository(User).save(user);
  }
}