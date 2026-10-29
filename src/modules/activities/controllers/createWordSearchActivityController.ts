import type { FastifyReply, FastifyRequest } from "fastify";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { makeCreateWordSearchActivityService } from "../factories/make-create-word-search-activity-service";
import { createWordSearchActivitySchema } from "../schemas/createWordSearchActivitySchema";

export async function createWordSearchActivityController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsedBody = createWordSearchActivitySchema.safeParse(
    request.body,
  );

  if (!parsedBody.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Os dados informados para a atividade são inválidos.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  try {
    const result = await AppDataSource.transaction(
      async (manager) => {
        const service = makeCreateWordSearchActivityService(manager);

        return service.execute({
          teacherId: request.user.sub,
          ...parsedBody.data,
        });
      },
    );

    return reply.status(201).send({
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
      "Falha ao criar caça-palavras.",
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