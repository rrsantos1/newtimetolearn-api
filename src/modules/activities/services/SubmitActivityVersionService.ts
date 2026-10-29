import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

interface SubmitActivityVersionInput {
  slug: string;
  teacherId: string;
}

interface SubmitActivityVersionResult {
  activity: Activity;
  version: ActivityVersion;
}

export class SubmitActivityVersionService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: SubmitActivityVersionInput,
  ): Promise<SubmitActivityVersionResult> {
    const activity =
      await this.activityRepository.findBySlugWithVersions(input.slug);

    if (
      !activity ||
      activity.deletedAt !== null ||
      activity.teacherId !== input.teacherId
    ) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError(
        "ACTIVITY_NOT_SUBMITTABLE",
        409,
        "Atividades arquivadas não podem ser enviadas para revisão.",
      );
    }

    const latestVersion = [...(activity.versions ?? [])].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    )[0];

    if (!latestVersion) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_FOUND",
        409,
        "A atividade não possui uma versão para envio.",
      );
    }

    if (latestVersion.status !== ActivityVersionStatus.DRAFT) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_SUBMITTABLE",
        409,
        "Somente a versão mais recente em rascunho pode ser enviada para revisão.",
      );
    }

    latestVersion.status = ActivityVersionStatus.PENDING_REVIEW;
    latestVersion.submittedAt = new Date();
    latestVersion.reviewFeedback = null;
    latestVersion.reviewedAt = null;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      latestVersion,
    );

    return {
      activity,
      version: savedVersion,
    };
  }
}