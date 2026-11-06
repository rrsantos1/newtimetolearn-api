import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { makeListActivitiesService } from "../factories/make-list-activities-service";
import { ActivityType } from "../types/ActivityType";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(120).optional(),
  type: z.nativeEnum(ActivityType).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});

export async function listPublicActivitiesController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Os filtros são inválidos." },
      requestId: request.id,
    });
  }

  try {
    const service = makeListActivitiesService();
    const data = await service.execute({
      ...parsed.data,
      scope: "public",
    });
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao listar atividades públicas.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
