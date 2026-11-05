import { IsNull } from "typeorm";
import { AppDataSource } from "../../../../shared/database/data-source";
import { Notification } from "../../entities/Notification";
import type {
  CreateNotificationData,
  INotificationRepository,
} from "../interfaces/INotificationRepository";

export class NotificationRepository implements INotificationRepository {
  private readonly repository = AppDataSource.getRepository(Notification);

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.repository.create({
      ...data,
      link: data.link ?? null,
      metadata: data.metadata ?? {},
      readAt: null,
    });
    return this.repository.save(notification);
  }

  async listForUser(userId: string, limit: number): Promise<Notification[]> {
    return this.repository.find({
      where: { recipientId: userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.repository.count({
      where: { recipientId: userId, readAt: IsNull() },
    });
  }

  async findForUser(notificationId: string, userId: string): Promise<Notification | null> {
    return this.repository.findOne({
      where: { id: notificationId, recipientId: userId },
    });
  }

  async save(notification: Notification): Promise<Notification> {
    return this.repository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.update(
      { recipientId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}
