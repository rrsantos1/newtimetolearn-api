import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { makeGetQuarantinedMediaAssetService } from "../factories/make-media-asset-services";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function getQuarantinedMediaAssetController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Identificador da imagem inválido." }, requestId: request.id });
  }
  try {
    const result = await makeGetQuarantinedMediaAssetService().execute(params.data.id);
    return reply.header("Cache-Control", "private, no-store").type(result.contentType).send(result.body);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "MEDIA_ASSET_NOT_FOUND") {
      return reply.status(404).send({ success: false, error: { code: error.message, message: "Imagem não encontrada." }, requestId: request.id });
    }
    if (error instanceof Error && error.message === "MEDIA_ASSET_NOT_PENDING") {
      return reply.status(409).send({ success: false, error: { code: error.message, message: "A imagem não está aguardando revisão." }, requestId: request.id });
    }
    request.log.error({ err: error }, "Falha ao obter prévia de imagem em quarentena.");
    return reply.status(500).send({ success: false, error: { code: "MEDIA_ASSET_PREVIEW_FAILED", message: "Não foi possível carregar a prévia da imagem." }, requestId: request.id });
  }
}
