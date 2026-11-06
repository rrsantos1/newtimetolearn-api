import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../../shared/config/env";
import { RoleCode } from "../../users/types/RoleCode";
import { MediaAssetRepository } from "../repositories/implementations/MediaAssetRepository";

export async function getMediaStorageUsageController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const isAdmin = request.user.roles.includes(RoleCode.ADMIN);
    const usageBytes = await new MediaAssetRepository().getStorageUsage(request.user.sub);
    const limitBytes = isAdmin ? null : env.TEACHER_STORAGE_LIMIT_BYTES;
    return reply.status(200).send({
      success: true,
      data: {
        usageBytes,
        limitBytes,
        unlimited: isAdmin,
        usagePercentage: limitBytes === null
          ? null
          : Math.min(100, Math.round((usageBytes / limitBytes) * 100)),
      },
      requestId: request.id,
    });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao consultar o uso de armazenamento.");
    return reply.status(500).send({
      success: false,
      error: {
        code: "MEDIA_STORAGE_USAGE_FAILED",
        message: "Não foi possível consultar o uso de armazenamento.",
      },
      requestId: request.id,
    });
  }
}
