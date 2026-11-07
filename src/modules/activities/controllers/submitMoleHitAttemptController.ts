import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeSubmitMoleHitAttemptService } from "../factories/make-submit-mole-hit-attempt-service";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });
const bodySchema = z.object({
  hits: z.number().int().min(0).max(10000),
  misses: z.number().int().min(0).max(10000),
  elapsedSeconds: z.number().int().min(0).max(300),
}).strict();

export async function submitMoleHitAttemptController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Os dados da tentativa são inválidos." }, requestId: request.id });
  }
  try {
    const result = await makeSubmitMoleHitAttemptService().execute({
      slug: params.data.slug,
      userId: request.user.sub,
      ...body.data,
    });
    return reply.status(201).send({
      success: true,
      data: {
        attempt: {
          id: result.attempt.id,
          score: result.attempt.score,
          accuracyPoints: result.accuracyPoints,
          speedPoints: result.speedPoints,
          hits: body.data.hits,
          misses: body.data.misses,
          elapsedSeconds: result.attempt.elapsedSeconds,
          createdAt: result.attempt.createdAt,
        },
        ranking: result.ranking.map((entry, index) => ({
          position: index + 1,
          studentName: entry.studentName,
          score: entry.score,
          elapsedSeconds: entry.elapsedSeconds,
          createdAt: entry.createdAt,
        })),
        isInRanking: result.isInRanking,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    }
    request.log.error({ err: error }, "Falha ao registrar tentativa de Acertar a Toupeira.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
