import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { MediaAssetRepository } from "../repositories/implementations/MediaAssetRepository";
import { RoleCode } from "../../users/types/RoleCode";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });
const bodySchema = z.object({
  coverMediaAssetId: z.string().uuid().nullable(),
});

export async function updateActivityCoverController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Os dados da capa são inválidos." },
      requestId: request.id,
    });
  }

  try {
    const activityRepository = new ActivityRepository();
    const isAdmin = request.user.roles.includes(RoleCode.ADMIN);
    const activity = isAdmin
      ? await activityRepository.findBySlug(params.data.slug)
      : await activityRepository.findBySlugAndTeacherId(params.data.slug, request.user.sub);

    if (!activity || activity.deletedAt !== null) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }

    const assetId = body.data.coverMediaAssetId;
    if (assetId !== null) {
      const asset = await new MediaAssetRepository().findById(assetId);
      if (!asset || asset.status !== "APPROVED") {
        throw new AppError("COVER_IMAGE_NOT_AVAILABLE", 422, "Selecione uma imagem aprovada da biblioteca.");
      }
      activity.coverMediaAssetId = asset.id;
    } else {
      activity.coverMediaAssetId = null;
    }

    const saved = await activityRepository.save(AppDataSource.manager, activity);
    const asset = saved.coverMediaAssetId
      ? await new MediaAssetRepository().findById(saved.coverMediaAssetId)
      : null;

    return reply.status(200).send({
      success: true,
      data: {
        coverMediaAssetId: saved.coverMediaAssetId,
        coverImageUrl: asset?.status === "APPROVED" ? asset.publicUrl : null,
        coverAltText: asset?.status === "APPROVED" ? asset.altText : null,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao atualizar a capa da atividade.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Não foi possível atualizar a capa." },
      requestId: request.id,
    });
  }
}
