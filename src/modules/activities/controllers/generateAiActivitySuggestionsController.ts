import type { FastifyReply, FastifyRequest } from "fastify";
import { aiActivitySuggestionsSchema } from "../schemas/aiActivitySuggestionsSchema";
import { GenerateAiActivitySuggestionsService } from "../services/GenerateAiActivitySuggestionsService";

const service = new GenerateAiActivitySuggestionsService();

export async function generateAiActivitySuggestionsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = aiActivitySuggestionsSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Confira o tema, a quantidade e as opções informadas.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  try {
    const data = await service.execute(parsed.data);
    return reply.send({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar sugestões.";
    const statusCode = message.includes("não está configurada") ? 503
      : message.includes("temporariamente ocupado") ? 429 : 502;

    request.log.error({ err: error }, "Falha ao gerar sugestões pedagógicas com IA.");

    return reply.status(statusCode).send({
      success: false,
      error: {
        code: statusCode === 503 ? "AI_NOT_CONFIGURED" : statusCode === 429 ? "AI_RATE_LIMITED" : "AI_GENERATION_FAILED",
        message,
      },
      requestId: request.id,
    });
  }
}
