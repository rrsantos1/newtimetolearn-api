import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeChangePasswordService } from "../factories/make-change-password-service";
import { changePasswordSchema } from "../schemas/changePasswordSchema";

export async function changePasswordController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const input = changePasswordSchema.parse(request.body);
    const userId = request.user.sub;

    const service = makeChangePasswordService();

    await service.execute(userId, input);

    return reply.status(200).send({
      success: true,
      data: {
        message: "Senha alterada com sucesso.",
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados de senha informados são inválidos.",
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
      "Falha ao alterar senha.",
    );

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno.",
      },
      requestId: request.id,
    });
  }
}