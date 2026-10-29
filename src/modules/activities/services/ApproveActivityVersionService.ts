import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

interface ApproveActivityVersionInput {
  slug: string;
}

interface ApproveActivityVersionResult {
  activity: Activity;
  version: ActivityVersion;
}

export class ApproveActivityVersionService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: ApproveActivityVersionInput,
  ): Promise<ApproveActivityVersionResult> {
    const activity =
      await this.activityRepository.findBySlugWithVersions(input.slug);

    if (!activity || activity.deletedAt !== null) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError(
        "ACTIVITY_NOT_APPROVABLE",
        409,
        "Atividades arquivadas não podem ser aprovadas.",
      );
    }

    const latestVersion = [...(activity.versions ?? [])].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    )[0];

    if (!latestVersion) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_FOUND",
        409,
        "A atividade não possui uma versão para aprovação.",
      );
    }

    if (
        latestVersion.status !== ActivityVersionStatus.PENDING_REVIEW
        ) {
        throw new AppError(
            "ACTIVITY_VERSION_NOT_AWAITING_APPROVAL",
            409,
            "A versão mais recente não está aguardando aprovação.",
        );
    }

    const publishedAt = new Date();

    latestVersion.status = ActivityVersionStatus.PUBLISHED;
    latestVersion.publishedAt = publishedAt;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      latestVersion,
    );

    activity.status = ActivityStatus.PUBLISHED;
    activity.currentPublishedVersionId = savedVersion.id;

    const savedActivity = await this.activityRepository.save(
      this.manager,
      activity,
    );

    return {
      activity: savedActivity,
      version: savedVersion,
    };
  }
}