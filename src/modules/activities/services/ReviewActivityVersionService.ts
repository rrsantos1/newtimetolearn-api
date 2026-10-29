import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export type ActivityReviewDecision = "REJECT" | "REQUEST_CHANGES";

interface ReviewActivityVersionInput {
  slug: string;
  decision: ActivityReviewDecision;
  feedback: string;
}

interface ReviewActivityVersionResult {
  activity: Activity;
  version: ActivityVersion;
}

export class ReviewActivityVersionService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: ReviewActivityVersionInput,
  ): Promise<ReviewActivityVersionResult> {
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
        "ACTIVITY_NOT_REVIEWABLE",
        409,
        "Atividades arquivadas não podem ser revisadas.",
      );
    }

    const latestVersion = [...(activity.versions ?? [])].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    )[0];

    if (!latestVersion) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_FOUND",
        409,
        "A atividade não possui uma versão para revisão.",
      );
    }

    if (latestVersion.status !== ActivityVersionStatus.DRAFT) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_REVIEWABLE",
        409,
        "A versão mais recente não está disponível para revisão.",
      );
    }

    const feedback = input.feedback.trim();

    if (feedback.length < 10) {
      throw new AppError(
        "INVALID_REVIEW_FEEDBACK",
        400,
        "O feedback deve conter pelo menos 10 caracteres.",
      );
    }

    latestVersion.status =
      input.decision === "REJECT"
        ? ActivityVersionStatus.REJECTED
        : ActivityVersionStatus.CHANGES_REQUESTED;

    latestVersion.reviewFeedback = feedback;
    latestVersion.reviewedAt = new Date();

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