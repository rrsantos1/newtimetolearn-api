import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { makeListActivitiesService } from "../factories/make-list-activities-service";
import { listActivitiesQuerySchema } from "../schemas/listActivitiesQuerySchema";

export async function listActivitiesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsedQuery = listActivitiesQuerySchema.safeParse(
    request.query,
  );

  if (!parsedQuery.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Os parâmetros de consulta são inválidos.",
        details: parsedQuery.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  try {
    const isAdmin = request.user.roles.includes(RoleCode.ADMIN);

    const service = makeListActivitiesService();

    const result = await service.execute({
      ...parsedQuery.data,
      teacherId: isAdmin ? undefined : request.user.sub,
      includeAll: isAdmin,
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
      "Falha ao listar atividades.",
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