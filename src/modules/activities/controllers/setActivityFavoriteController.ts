import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeSetActivityFavoriteService } from "../factories/make-set-activity-favorite-service";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });
const bodySchema = z.object({ favorite: z.boolean() });

export async function setActivityFavoriteController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Os dados enviados são inválidos." },
      requestId: request.id,
    });
  }

  try {
    const service = makeSetActivityFavoriteService();
    const data = await service.execute({
      userId: request.user.sub,
      slug: params.data.slug,
      favorite: body.data.favorite,
    });
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao atualizar favorito da atividade.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
