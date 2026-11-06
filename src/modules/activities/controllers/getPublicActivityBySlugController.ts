import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { makeGetActivityBySlugService } from "../factories/make-get-activity-by-slug-service";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });

export async function getPublicActivityBySlugController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "O identificador da atividade é inválido." },
      requestId: request.id,
    });
  }

  try {
    const service = makeGetActivityBySlugService();
    const data = await service.execute({ slug: params.data.slug, userId: "", isAdmin: false, publicOnly: true });
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    request.log.warn({ err: error }, "Atividade pública indisponível.");
    return reply.status(404).send({
      success: false,
      error: { code: "ACTIVITY_NOT_FOUND", message: "Atividade pública não encontrada." },
      requestId: request.id,
    });
  }
}
