import { AuthError } from "../../auth/errors/AuthError";
import type {
  CreateNotificationData,
  INotificationRepository,
} from "../repositories/interfaces/INotificationRepository";

export class NotificationService {
  constructor(private readonly repository: INotificationRepository) {}

  async create(data: CreateNotificationData) {
    return this.repository.create(data);
  }

  async listForUser(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.repository.listForUser(userId, 30),
      this.repository.countUnread(userId),
    ]);
    return { items, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.repository.findForUser(notificationId, userId);
    if (!notification) {
      throw new AuthError("NOTIFICATION_NOT_FOUND", 404, "Notificação não encontrada.");
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.repository.save(notification);
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);
  }
}
