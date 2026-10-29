import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { makeEditWordSearchActivityService } from "../factories/make-edit-word-search-activity-service";
import { createWordSearchActivitySchema } from "../schemas/createWordSearchActivitySchema";
import { RoleCode } from "../../users/types/RoleCode";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export async function updateWordSearchActivityController(
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
        const service = makeEditWordSearchActivityService(manager);

        return service.execute({
            slug: parsedParams.data.slug,
            teacherId: request.user.sub,
            isAdmin: request.user.roles.includes(RoleCode.ADMIN),
            ...parsedBody.data,
        });
      },
    );

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
      "Falha ao editar caça-palavras.",
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