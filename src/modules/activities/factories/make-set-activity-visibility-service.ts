import { SetActivityVisibilityService } from "../services/SetActivityVisibilityService";

export function makeSetActivityVisibilityService(): SetActivityVisibilityService {
  return new SetActivityVisibilityService();
}
