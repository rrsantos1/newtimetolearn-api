import type { FastifyReply, FastifyRequest } from "fastify";
import { MediaAssetRepository } from "../repositories/implementations/MediaAssetRepository";
import { CleanupOrphanMediaFilesService } from "../services/CleanupOrphanMediaFilesService";

export async function cleanupOrphanMediaFilesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const result = await new CleanupOrphanMediaFilesService(
      new MediaAssetRepository(),
    ).execute();
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
