import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeRequestEmailChangeService } from "../factories/make-request-email-change-service";
import { requestEmailChangeSchema } from "../schemas/requestEmailChangeSchema";

export async function requestEmailChangeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = requestEmailChangeSchema.parse(request.body);
    const service = makeRequestEmailChangeService();
    const result = await service.execute(request.user.sub, input);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos.",
          details: error.issues,
        },
        requestId: request.id,
      });
    }

    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha ao solicitar alteração de e-mail");

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível processar a solicitação.",
      },
      requestId: request.id,
    });
  }
}