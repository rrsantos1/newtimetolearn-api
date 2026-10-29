import type { IUserProfileRepository } from "../repositories/interfaces/IUserProfileRepository";

export class GetUserProfileService {
  constructor(
    private readonly userProfileRepository: IUserProfileRepository,
  ) {}

  async execute(userId: string) {
    return this.userProfileRepository.findById(userId);
  }
}