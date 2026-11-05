import type { FastifyReply, FastifyRequest } from "fastify";
import { makeNotificationService } from "../factories/make-notification-service";

export async function listNotificationsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const result = await makeNotificationService().listForUser(request.user.sub);
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao listar notificações.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
