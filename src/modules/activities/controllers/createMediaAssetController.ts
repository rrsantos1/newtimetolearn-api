import type { FastifyReply, FastifyRequest } from "fastify";
import { makeCreateMediaAssetService } from "../factories/make-media-asset-services";
import { createMediaAssetSchema } from "../schemas/mediaAssetSchema";

export async function createMediaAssetController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createMediaAssetSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({
    success: false, error: { code: "VALIDATION_ERROR", message: "Os dados da imagem são inválidos.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, requestId: request.id,
  });
  try {
    const asset = await makeCreateMediaAssetService().execute({ uploadedBy: request.user.sub, ...parsed.data });
    return reply.status(201).send({ success: true, data: asset });
  } catch (error: unknown) {
    if (error instanceof Error && ["UNSUPPORTED_IMAGE_TYPE", "INVALID_IMAGE_SIZE", "INVALID_STORAGE_KEY", "INVALID_PUBLIC_URL"].includes(error.message)) {
      return reply.status(400).send({ success: false, error: { code: error.message, message: "A imagem não atende aos requisitos permitidos." }, requestId: request.id });
    }
    request.log.error({ err: error }, "Falha ao registrar imagem na biblioteca.");
    return reply.status(500).send({ success: false, error: { code: "MEDIA_ASSET_CREATE_FAILED", message: "Não foi possível registrar a imagem." }, requestId: request.id });
  }
}
