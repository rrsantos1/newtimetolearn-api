import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { StorageUsageRepository } from "../../../shared/storage/repositories/StorageUsageRepository";
import { CleanupOrphanMediaFilesService } from "../services/CleanupOrphanMediaFilesService";

export async function cleanupOrphanMediaFilesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z.object({ confirm: z.boolean().default(false) }).safeParse(request.body ?? {});
  if (!body.success) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "A confirmação da limpeza é inválida." }, requestId: request.id });
  }
  try {
    const result = await new CleanupOrphanMediaFilesService(
      new StorageUsageRepository(),
    ).execute(!body.data.confirm);
    return reply.status(200).send({
      success: true,
      data: result,
      requestId: request.id,
    });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao limpar arquivos órfãos da biblioteca de mídia.");
    return reply.status(500).send({
      success: false,
      error: {
        code: "MEDIA_ORPHAN_CLEANUP_FAILED",
        message: "Não foi possível concluir a limpeza dos arquivos órfãos.",
      },
      requestId: request.id,
    });
  }
}
