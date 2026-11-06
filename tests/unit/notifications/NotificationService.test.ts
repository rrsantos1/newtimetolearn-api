import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notification } from "../../src/modules/notifications/entities/Notification";
import type { INotificationRepository } from "../../src/modules/notifications/repositories/interfaces/INotificationRepository";
import { NotificationService } from "../../src/modules/notifications/services/NotificationService";

describe("NotificationService", () => {
  let service: NotificationService;
  let repository: INotificationRepository;

  const userId = "user-123";
  const notificationId = "notification-123";

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      create: vi.fn(),
      listForUser: vi.fn().mockResolvedValue([]),
      countUnread: vi.fn().mockResolvedValue(0),
      findForUser: vi.fn(),
      save: vi.fn(),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
    };

    service = new NotificationService(repository);
  });

  it("cria uma notificação usando o repositório", async () => {
    const data = {
      recipientId: userId,
      type: "NOTEBOOK_NOTE_REPLY",
      title: "Nova mensagem",
      message: "Você recebeu uma mensagem.",
      link: "/student/notebook",
      metadata: { relationshipId: "relationship-123" },
    };
    const created = { id: notificationId, ...data } as Notification;
    vi.mocked(repository.create).mockResolvedValueOnce(created);

    await expect(service.create(data)).resolves.toBe(created);
    expect(repository.create).toHaveBeenCalledWith(data);
  });

  it("lista as últimas notificações e a quantidade não lida em paralelo", async () => {
    const items = [{ id: notificationId }] as Notification[];
    vi.mocked(repository.listForUser).mockResolvedValueOnce(items);
    vi.mocked(repository.countUnread).mockResolvedValueOnce(3);

    await expect(service.listForUser(userId)).resolves.toEqual({
      items,
      unreadCount: 3,
    });

    expect(repository.listForUser).toHaveBeenCalledWith(userId, 30);
    expect(repository.countUnread).toHaveBeenCalledWith(userId);
  });

  it("marca uma notificação do próprio usuário como lida", async () => {
    const notification = Object.assign(new Notification(), {
      id: notificationId,
      recipientId: userId,
      readAt: null,
    });
    vi.mocked(repository.findForUser).mockResolvedValueOnce(notification);
    vi.mocked(repository.save).mockImplementation(async (value) => value);

    const result = await service.markAsRead(notificationId, userId);

    expect(result.readAt).toBeInstanceOf(Date);
    expect(repository.findForUser).toHaveBeenCalledWith(notificationId, userId);
    expect(repository.save).toHaveBeenCalledWith(notification);
  });

  it("não persiste novamente uma notificação já lida", async () => {
    const readAt = new Date("2026-11-01T10:00:00.000Z");
    const notification = Object.assign(new Notification(), {
      id: notificationId,
      recipientId: userId,
      readAt,
    });
    vi.mocked(repository.findForUser).mockResolvedValueOnce(notification);

    await expect(service.markAsRead(notificationId, userId)).resolves.toBe(notification);

    expect(notification.readAt).toBe(readAt);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("retorna 404 quando a notificação não pertence ao usuário ou não existe", async () => {
    vi.mocked(repository.findForUser).mockResolvedValueOnce(null);

    await expect(service.markAsRead(notificationId, userId)).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
      statusCode: 404,
    });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it("marca todas as notificações do usuário como lidas", async () => {
    await expect(service.markAllAsRead(userId)).resolves.toBeUndefined();

    expect(repository.markAllAsRead).toHaveBeenCalledWith(userId);
  });

  it("propaga erros do repositório ao listar notificações", async () => {
    vi.mocked(repository.listForUser).mockRejectedValueOnce(new Error("Database unavailable"));

    await expect(service.listForUser(userId)).rejects.toThrow("Database unavailable");
  });
});
