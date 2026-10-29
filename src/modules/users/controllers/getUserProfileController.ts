import type { FastifyReply, FastifyRequest } from "fastify";
import { makeGetUserProfileService } from "../factories/make-get-user-profile-service";

export async function getUserProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const service = makeGetUserProfileService();
    const profile = await service.execute(request.user.sub);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "Usuário não encontrado.",
        },
        requestId: request.id,
      });
    }

    return reply.status(200).send({
      success: true,
      data: profile,
    });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao consultar perfil.");

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