import type { FastifyReply, FastifyRequest } from "fastify";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import { createImageUploadUrlSchema } from "../../../shared/storage/schemas/createImageUploadUrlSchema";

export async function createQuizImageUploadUrlController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = createImageUploadUrlSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Tipo de arquivo inválido.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId: request.id,
    });
  }

  try {
    const result = await makeStorageProvider().createUploadUrl(parsed.data);
    return reply.status(201).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof Error && (
      error.message === "UNSUPPORTED_IMAGE_TYPE" ||
      error.message === "INVALID_IMAGE_EXTENSION"
    )) {
      return reply.status(400).send({
        success: false,
        error: { code: error.message, message: "Formato de imagem não permitido." },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha ao gerar URL de upload para imagem.");
    return reply.status(500).send({
      success: false,
      error: {
        code: "STORAGE_UPLOAD_URL_FAILED",
        message: "Não foi possível preparar o envio da imagem.",
      },
      requestId: request.id,
    });
  }
}
