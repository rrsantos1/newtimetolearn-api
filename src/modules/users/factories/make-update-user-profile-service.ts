
import { UpdateUserProfileRepository } from "../repositories/implementations/UpdateUserProfileRepository";
import { UserProfileRepository } from "../repositories/implementations/UserProfileRepository";
import { UpdateUserProfileService } from "../services/UpdateUserProfileService";

export function makeUpdateUserProfileService(): UpdateUserProfileService {
  return new UpdateUserProfileService(
    new UpdateUserProfileRepository(),
    new UserProfileRepository(),
  );
}