import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeGetWordSearchRankingService } from "../factories/make-get-word-search-ranking-service";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(150),
});

export async function getWordSearchRankingController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsedParams = paramsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "O identificador da atividade é inválido.",
      },
      requestId: request.id,
    });
  }

  try {
    const service = makeGetWordSearchRankingService();
    const ranking = await service.execute(parsedParams.data.slug);

    return reply.status(200).send({
      success: true,
      data: { ranking },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha ao consultar ranking do caça-palavras.");
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