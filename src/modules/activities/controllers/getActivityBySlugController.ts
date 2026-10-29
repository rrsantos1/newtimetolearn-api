import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { makeGetActivityBySlugService } from "../factories/make-get-activity-by-slug-service";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(150),
});

export async function getActivityBySlugController(
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
        details: parsedParams.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  try {
    const service = makeGetActivityBySlugService();

    const result = await service.execute({
      slug: parsedParams.data.slug,
      userId: request.user.sub,
      isAdmin: request.user.roles.includes(RoleCode.ADMIN),
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
      "Falha ao consultar atividade.",
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