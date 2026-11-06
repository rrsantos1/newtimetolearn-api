import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export class SetActivityVisibilityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(input: { slug: string; visibility: ActivityVisibility }): Promise<{ slug: string; visibility: ActivityVisibility }> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.deletedAt !== null) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }
    if (activity.status !== ActivityStatus.PUBLISHED || !activity.currentPublishedVersionId) {
      throw new AppError("ACTIVITY_NOT_PUBLISHED", 409, "Somente atividades aprovadas podem ser disponibilizadas publicamente.");
    }
    const publishedVersion = activity.versions?.find(
      (version) => version.id === activity.currentPublishedVersionId && version.status === ActivityVersionStatus.PUBLISHED,
    );
    if (!publishedVersion) {
      throw new AppError("ACTIVITY_NOT_PUBLISHED", 409, "A atividade não possui uma versão aprovada.");
    }

    activity.visibility = input.visibility;
    await this.activityRepository.save(this.manager, activity);
    return { slug: activity.slug, visibility: activity.visibility };
  }
}
