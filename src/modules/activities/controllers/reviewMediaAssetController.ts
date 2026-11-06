import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { makeReviewMediaAssetService } from "../factories/make-media-asset-services";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]) });


export async function reviewMediaAssetController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Informe uma imagem válida e a decisão de revisão." }, requestId: request.id });
  }
  try {
    const asset = await makeReviewMediaAssetService().execute(params.data.id, body.data.decision);
    return reply.send({ success: true, data: asset });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "STORAGE_QUOTA_EXCEEDED") {
      return reply.status(413).send({ success: false, error: { code: error.message, message: "A imagem não pode ser aprovada porque ultrapassaria a cota de armazenamento do professor." }, requestId: request.id });
    }
    if (error instanceof Error && error.message === "MEDIA_ASSET_NOT_FOUND") {
      return reply.status(404).send({ success: false, error: { code: error.message, message: "Imagem não encontrada." }, requestId: request.id });
    }
    if (error instanceof Error && error.message === "MEDIA_ASSET_ALREADY_REVIEWED") {
      return reply.status(409).send({ success: false, error: { code: error.message, message: "Esta imagem já foi revisada." }, requestId: request.id });
    }
    request.log.error({ err: error }, "Falha ao revisar imagem.");
    return reply.status(500).send({ success: false, error: { code: "MEDIA_ASSET_REVIEW_FAILED", message: "Não foi possível concluir a revisão da imagem." }, requestId: request.id });
  }
}
