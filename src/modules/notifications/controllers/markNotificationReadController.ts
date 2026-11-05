import type { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeNotificationService } from "../factories/make-notification-service";

const paramsSchema = z.object({ notificationId: z.uuid() });

export async function markNotificationReadController(
  request: FastifyRequest<{ Params: { notificationId: string } }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const { notificationId } = paramsSchema.parse(request.params);
    const result = await makeNotificationService().markAsRead(notificationId, request.user.sub);
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Identificador inválido." },
        requestId: request.id,
      });
    }
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao marcar notificação como lida.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
