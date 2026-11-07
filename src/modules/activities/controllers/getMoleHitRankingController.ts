import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityType } from "../types/ActivityType";
import { ActivityStatus } from "../types/ActivityStatus";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });

export async function getMoleHitRankingController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Identificador inválido." }, requestId: request.id });
  }
  try {
    const activity = await new ActivityRepository().findBySlugWithVersions(params.data.slug);
    if (!activity || activity.type !== ActivityType.MOLE_HIT || activity.status !== ActivityStatus.PUBLISHED) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }
    const ranking = await new ActivityAttemptRepository().getRanking(activity.id);
    return reply.status(200).send({
      success: true,
      data: {
        ranking: ranking.map((entry, index) => ({
          position: index + 1,
          studentName: entry.studentName,
          score: entry.score,
          elapsedSeconds: entry.elapsedSeconds,
          createdAt: entry.createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    }
    request.log.error({ err: error }, "Falha ao consultar ranking de Acertar a Toupeira.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
