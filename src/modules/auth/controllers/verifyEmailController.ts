import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeVerifyEmailService } from "../factories/make-verify-email-service";
import { verifyEmailSchema } from "../schemas/verifyEmailSchema";

export async function verifyEmailController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const { token } = verifyEmailSchema.parse(request.body);
    const service = makeVerifyEmailService();
    const result = await service.execute(token);

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
          message: "O token de confirmação é inválido.",
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

    request.log.error({ err: error }, "Falha ao confirmar e-mail");

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível confirmar o e-mail.",
      },
      requestId: request.id,
    });
  }
}