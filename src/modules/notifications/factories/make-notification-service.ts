import { NotificationRepository } from "../repositories/implementations/NotificationRepository";
import { NotificationService } from "../services/NotificationService";

export function makeNotificationService(): NotificationService {
  return new NotificationService(new NotificationRepository());
}
