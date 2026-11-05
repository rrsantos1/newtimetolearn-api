import type { FastifyReply, FastifyRequest } from "fastify";
import { makeNotificationService } from "../factories/make-notification-service";

export async function markAllNotificationsReadController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    await makeNotificationService().markAllAsRead(request.user.sub);
    return reply.status(200).send({ success: true });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao marcar notificações como lidas.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
