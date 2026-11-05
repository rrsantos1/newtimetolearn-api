import type { Notification } from "../../entities/Notification";

export interface CreateNotificationData {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

export interface INotificationRepository {
  create(data: CreateNotificationData): Promise<Notification>;
  listForUser(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  findForUser(notificationId: string, userId: string): Promise<Notification | null>;
  save(notification: Notification): Promise<Notification>;
  markAllAsRead(userId: string): Promise<void>;
}
