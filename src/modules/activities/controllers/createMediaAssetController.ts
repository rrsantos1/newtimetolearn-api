import type { FastifyReply, FastifyRequest } from "fastify";
import { makeCreateMediaAssetService } from "../factories/make-media-asset-services";

const maxFileSizeBytes = 5 * 1024 * 1024;
const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function decodeHeader(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value).trim().slice(0, 255);
  } catch {
    return fallback;
  }
}

export async function createMediaAssetController(request: FastifyRequest, reply: FastifyReply) {
  const contentType = request.headers["x-image-content-type"];
  const actualContentType = typeof contentType === "string" ? contentType : request.headers["content-type"]?.split(";")[0];
  if (!actualContentType || !allowedContentTypes.has(actualContentType)) {
    return reply.status(400).send({ success: false, error: { code: "UNSUPPORTED_IMAGE_TYPE", message: "Formato de imagem não permitido." }, requestId: request.id });
  }

  const imageBuffer = Buffer.isBuffer(request.body) ? request.body : null;
  if (!imageBuffer || imageBuffer.byteLength <= 0 || imageBuffer.byteLength > maxFileSizeBytes) {
    return reply.status(400).send({ success: false, error: { code: "INVALID_IMAGE_SIZE", message: "A imagem deve ter no máximo 5 MB." }, requestId: request.id });
  }

  const fileName = decodeHeader(request.headers["x-file-name"], "imagem");
  const altText = decodeHeader(request.headers["x-alt-text"], "");
  try {
    const asset = await makeCreateMediaAssetService().execute({
      uploadedBy: request.user.sub,
      fileName,
      contentType: actualContentType,
      sizeBytes: imageBuffer.byteLength,
      altText,
      imageBuffer,
    });
    if (asset.status === "PENDING_REVIEW") {
      return reply.status(202).send({ success: true, data: { ...asset, message: "A imagem foi guardada em quarentena privada e aguarda revisão administrativa." } });
    }
    return reply.status(201).send({ success: true, data: asset });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "IMAGE_REJECTED_BY_MODERATION") {
      return reply.status(422).send({ success: false, error: { code: error.message, message: "A imagem foi recusada pela validação automática de conteúdo." }, requestId: request.id });
    }
    if (error instanceof Error && ["UNSUPPORTED_IMAGE_TYPE", "INVALID_IMAGE_SIZE"].includes(error.message)) {
      return reply.status(400).send({ success: false, error: { code: error.message, message: "A imagem não atende aos requisitos permitidos." }, requestId: request.id });
    }
    request.log.error({ err: error }, "Falha ao moderar e armazenar imagem.");
    return reply.status(500).send({ success: false, error: { code: "MEDIA_ASSET_CREATE_FAILED", message: "Não foi possível armazenar a imagem." }, requestId: request.id });
  }
}
