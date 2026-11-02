import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { makeListListeningAttemptsService } from "../factories/make-list-listening-attempts-service";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listListeningAttemptsController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  const query = querySchema.safeParse(request.query);

  if (!params.success || !query.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Os parâmetros do histórico são inválidos." },
      requestId: request.id,
    });
  }

  try {
    const result = await makeListListeningAttemptsService().execute({
      slug: params.data.slug,
      userId: request.user.sub,
      isAdmin: request.user.roles.includes(RoleCode.ADMIN),
      ...query.data,
    });

    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha ao consultar histórico de Listening.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
