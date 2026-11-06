import { AppDataSource } from "../../../shared/database/data-source";
import { Activity } from "../entities/Activity";
import { AppError } from "../../../shared/errors/AppError";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export class SetActivityVisibilityService {
  async execute(input: { slug: string; visibility: ActivityVisibility }): Promise<{ slug: string; visibility: ActivityVisibility }> {
    const repository = AppDataSource.getRepository(Activity);
    const activity = await repository.createQueryBuilder("activity")
      .leftJoinAndSelect("activity.versions", "version")
      .where("activity.slug = :slug", { slug: input.slug })
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

    activity.visibility = input.visibility;
    await repository.save(activity);
    return { slug: activity.slug, visibility: activity.visibility };
  }
}
