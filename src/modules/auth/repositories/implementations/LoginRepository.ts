import { AppDataSource } from "../../../../shared/database/data-source";
import { User } from "../../../users/entities/User";
import { ILoginRepository, LoginUserRecord } from "../interfaces/ILoginRepository";


export class LoginRepository implements ILoginRepository {
  async findByEmail(email: string): Promise<LoginUserRecord | null> {
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { email },
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
      passwordHash: user.passwordHash,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      roles: user.userRoles.map((userRole) => userRole.role.code),
    };
  }
}