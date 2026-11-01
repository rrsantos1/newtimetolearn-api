import type { FastifyReply, FastifyRequest } from "fastify";
import { makeListPendingMediaAssetsService } from "../factories/make-media-asset-services";
import { listMediaAssetsQuerySchema } from "../schemas/mediaAssetSchema";

export async function listPendingMediaAssetsController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listMediaAssetsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Os filtros da revisão são inválidos." }, requestId: request.id });
  }
  try {
    const result = await makeListPendingMediaAssetsService().execute(parsed.data);
    return reply.send({ success: true, data: { items: result.items, pagination: { page: parsed.data.page, limit: parsed.data.limit, total: result.total, totalPages: Math.ceil(result.total / parsed.data.limit) } } });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao consultar imagens pendentes.");
    return reply.status(500).send({ success: false, error: { code: "MEDIA_ASSET_REVIEW_LIST_FAILED", message: "Não foi possível consultar as imagens pendentes." }, requestId: request.id });
  }
}
