import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeSubmitWordSearchAttemptService } from "../factories/make-submit-word-search-attempt-service";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(150),
});

const bodySchema = z.object({
  wordsFound: z.array(z.string().trim().max(120)).max(100),
  elapsedSeconds: z.number().int().min(0).max(86_400),
});

export async function submitWordSearchAttemptController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsedParams = paramsSchema.safeParse(request.params);
  const parsedBody = bodySchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Os dados da tentativa são inválidos.",
      },
      requestId: request.id,
    });
  }

  try {
    const service = makeSubmitWordSearchAttemptService();
    const result = await service.execute({
      slug: parsedParams.data.slug,
      userId: request.user.sub,
      ...parsedBody.data,
    });

    return reply.status(201).send({
      success: true,
      data: {
        attempt: {
          id: result.attempt.id,
          score: result.attempt.score,
          accuracyPoints: result.attempt.accuracyPoints,
          speedPoints: result.attempt.speedPoints,
          totalWords: result.attempt.totalWords,
          wordsFound: result.attempt.wordsFound,
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
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha ao registrar tentativa da atividade.");
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
