import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeUpdateUserProfileService } from "../factories/make-update-user-profile-service";
import { updateUserProfileSchema } from "../schemas/updateUserProfileSchema";

export async function updateUserProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const input = updateUserProfileSchema.parse(request.body);
    const service = makeUpdateUserProfileService();

    const profile = await service.execute(request.user.sub, input);

    return reply.status(200).send({
      success: true,
      data: profile,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Informe um nome válido.",
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

    request.log.error({ err: error }, "Falha ao atualizar perfil.");

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