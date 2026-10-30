import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { makeEditCrosswordActivityService } from "../factories/make-edit-crossword-activity-service";
import { createCrosswordActivitySchema } from "../schemas/createCrosswordActivitySchema";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(150),
});

export async function editCrosswordActivityController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsedParams = paramsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "O identificador da cruzadinha é inválido.",
        details: parsedParams.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  const parsedBody = createCrosswordActivitySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Os dados informados para a cruzadinha são inválidos.",
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
      const service = makeEditCrosswordActivityService(manager);

      return service.execute({
        slug: parsedParams.data.slug,
        teacherId: request.user.sub,
        isAdmin: request.user.roles.includes(RoleCode.ADMIN),
        ...parsedBody.data,
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

    request.log.error({ err: error }, "Falha ao editar cruzadinha.");

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
