import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeConfirmEmailChangeService } from "../factories/make-confirm-email-change-service";
import { confirmEmailChangeSchema } from "../schemas/confirmEmailChangeSchema";

export async function confirmEmailChangeController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = confirmEmailChangeSchema.parse(request.body);
    const service = makeConfirmEmailChangeService();
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

    request.log.error(
      { err: error },
      "Falha ao confirmar alteração de e-mail",
    );

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível confirmar a alteração de e-mail.",
      },
      requestId: request.id,
    });
  }
}