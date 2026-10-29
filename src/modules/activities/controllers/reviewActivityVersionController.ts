import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { makeReviewActivityVersionService } from "../factories/make-review-activity-version-service";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

const bodySchema = z.object({
  decision: z.enum(["REJECT", "REQUEST_CHANGES"]),
  feedback: z.string().trim().min(10).max(2000),
});

export async function reviewActivityVersionController(
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

  const parsedBody = bodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "A decisão ou o feedback informado é inválido.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const service = makeReviewActivityVersionService(manager);

      return service.execute({
        slug: parsedParams.data.slug,
        decision: parsedBody.data.decision,
        feedback: parsedBody.data.feedback,
      });
    });

    return reply.status(200).send({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        requestId: request.id,
      });
    }

    request.log.error(
      { err: error },
      "Falha ao revisar versão da atividade.",
    );

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