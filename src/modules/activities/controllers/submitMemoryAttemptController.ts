import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeSubmitMemoryAttemptService } from "../factories/make-submit-memory-attempt-service";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });
const bodySchema = z.object({
  matchedPairIds: z.array(z.string().trim().min(1).max(50)).max(50),
  wrongAttempts: z.number().int().min(0).max(10_000),
  elapsedSeconds: z.number().int().min(0).max(86_400),
}).strict();

export async function submitMemoryAttemptController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Os dados da tentativa são inválidos." }, requestId: request.id });
  }

  try {
    const result = await makeSubmitMemoryAttemptService().execute({
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
          accuracyPoints: result.attempt.accuracyPoints,
          speedPoints: result.attempt.speedPoints,
          totalPairs: result.totalPairs,
          matchedPairs: result.matchedPairs,
          wrongAttempts: body.data.wrongAttempts,
          penaltyPoints: result.penaltyPoints,
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
    request.log.error({ err: error }, "Falha ao registrar tentativa do jogo da memória.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
