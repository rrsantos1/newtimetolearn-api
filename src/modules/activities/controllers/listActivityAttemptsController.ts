import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { makeListActivityAttemptsService } from "../factories/make-list-activity-attempts-service";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(150),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listActivityAttemptsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsedParams = paramsSchema.safeParse(request.params);
  const parsedQuery = querySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Os parâmetros da consulta ao histórico são inválidos.",
      },
      requestId: request.id,
    });
  }

  try {
    const service = makeListActivityAttemptsService();
    const result = await service.execute({
      slug: parsedParams.data.slug,
      userId: request.user.sub,
      isAdmin: request.user.roles.includes(RoleCode.ADMIN),
      ...parsedQuery.data,
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
      "Falha ao consultar histórico de tentativas da atividade.",
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
