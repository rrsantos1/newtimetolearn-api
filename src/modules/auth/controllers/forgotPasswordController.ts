import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { makeForgotPasswordService } from "../factories/make-forgot-password-service";
import { forgotPasswordSchema } from "../schemas/forgotPasswordSchema";

export async function forgotPasswordController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { email } = forgotPasswordSchema.parse(request.body);

    const service = makeForgotPasswordService((error) => {
      request.log.error({ err: error }, "Falha ao enviar e-mail de recuperação.");
    });

    await service.execute(email);

    return reply.status(200).send({
      success: true,
      data: {
        message: "Se o endereço estiver cadastrado, você receberá instruções para recuperar sua senha.",
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Informe um endereço de e-mail válido.",
        },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha ao solicitar recuperação de senha.");

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