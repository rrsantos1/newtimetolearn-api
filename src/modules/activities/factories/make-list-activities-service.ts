import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ListActivitiesService } from "../services/ListActivitiesService";

export function makeListActivitiesService(): ListActivitiesService {
  return new ListActivitiesService(new ActivityRepository());
}