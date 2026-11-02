import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeGetDragDropActivityRankingService } from "../factories/make-get-drag-drop-activity-ranking-service";
import type { DragDropActivityType } from "../services/CreateDragDropActivityService";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });

export function makeGetDragDropActivityRankingController(activityType: DragDropActivityType) {
  return async function getDragDropActivityRankingController(request: FastifyRequest, reply: FastifyReply) {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "O identificador da atividade é inválido." }, requestId: request.id });
    }
    try {
      const ranking = await makeGetDragDropActivityRankingService(activityType).execute(params.data.slug);
      return reply.status(200).send({ success: true, data: { ranking } });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
      }
      request.log.error({ err: error }, "Falha ao consultar ranking da atividade.");
      return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
    }
  };
}
