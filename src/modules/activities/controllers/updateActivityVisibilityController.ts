import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { Activity } from "../entities/Activity";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });
const bodySchema = z.object({ visibility: z.nativeEnum(ActivityVisibility) });

export async function updateActivityVisibilityController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);
  if (!params.success || !body.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Os dados enviados são inválidos." },
      requestId: request.id,
    });
  }

  try {
    const repository = AppDataSource.getRepository(Activity);
    const activity = await repository.createQueryBuilder("activity")
      .leftJoinAndSelect("activity.versions", "version")
      .where("activity.slug = :slug", { slug: params.data.slug })
      .andWhere("activity.deleted_at IS NULL")
      .getOne();

    if (!activity) throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    if (activity.status !== ActivityStatus.PUBLISHED || !activity.currentPublishedVersionId) {
      throw new AppError("ACTIVITY_NOT_PUBLISHED", 409, "Somente atividades aprovadas podem ser disponibilizadas publicamente.");
    }
    const publishedVersion = activity.versions.find(
      (version) => version.id === activity.currentPublishedVersionId && version.status === ActivityVersionStatus.PUBLISHED,
    );
    if (!publishedVersion) throw new AppError("ACTIVITY_NOT_PUBLISHED", 409, "A atividade não possui uma versão aprovada.");

    activity.visibility = body.data.visibility;
    await repository.save(activity);

    return reply.status(200).send({
      success: true,
      data: { slug: activity.slug, visibility: activity.visibility },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao atualizar visibilidade da atividade.");
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
      requestId: request.id,
    });
  }
}
