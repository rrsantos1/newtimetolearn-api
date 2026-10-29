
import { UserProfileRepository } from "../repositories/implementations/UserProfileRepository";
import { GetUserProfileService } from "../services/GetUserProfileService";

export function makeGetUserProfileService(): GetUserProfileService {
  return new GetUserProfileService(new UserProfileRepository());
}
