import { AuthError } from "../../auth/errors/AuthError";
import type { IUpdateUserProfileRepository } from "../repositories/interfaces/IUpdateUserProfileRepository";
import type { IUserProfileRepository } from "../repositories/interfaces/IUserProfileRepository";
import type { UpdateUserProfileInput } from "../schemas/updateUserProfileSchema";

export class UpdateUserProfileService {
  constructor(
    private readonly repository: IUpdateUserProfileRepository,
    private readonly userProfileRepository: IUserProfileRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateUserProfileInput,
  ) {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new AuthError(
        "USER_NOT_FOUND",
        404,
        "Usuário não encontrado.",
      );
    }

    user.name = input.name;

    const updatedUser = await this.repository.save(user);

    const profile = await this.userProfileRepository.findById(
      updatedUser.id,
    );

    if (!profile) {
      throw new AuthError(
        "USER_NOT_FOUND",
        404,
        "Usuário não encontrado.",
      );
    }

    return profile;
  }
}