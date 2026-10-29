import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeResetPasswordService } from "../factories/make-reset-password-service";
import { resetPasswordSchema } from "../schemas/resetPasswordSchema";

export async function resetPasswordController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const input = resetPasswordSchema.parse(request.body);
    const service = makeResetPasswordService();

    await service.execute(input);

    return reply.status(200).send({
      success: true,
      data: {
        message: "Senha redefinida com sucesso.",
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Token inválido ou dados de senha inválidos.",
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
      "Falha ao redefinir senha.",
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