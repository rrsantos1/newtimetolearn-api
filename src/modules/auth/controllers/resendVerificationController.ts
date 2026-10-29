import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { makeResendVerificationService } from "../factories/make-resend-verification-service";
import { resendVerificationSchema } from "../schemas/resendVerificationSchema";

export async function resendVerificationController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const { email } = resendVerificationSchema.parse(request.body);

    const service = makeResendVerificationService((error) => {
      request.log.error({ err: error }, "Falha no reenvio de confirmação");
    });

    const result = await service.execute(email);

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
          message: "Informe um endereço de e-mail válido.",
        },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Erro no endpoint de reenvio");

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