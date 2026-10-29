import { AppDataSource } from "../../../../shared/database/data-source";
import { User } from "../../entities/User";
import { IUserProfileRepository, UserProfileRecord } from "../interfaces/IUserProfileRepository";

export class UserProfileRepository implements IUserProfileRepository {
  async findById(id: string): Promise<UserProfileRecord | null> {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id },
      relations: {
        userRoles: {
          role: true,
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map((userRole) => userRole.role.code),
    };
  }
}