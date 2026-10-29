import type { Activity } from "../entities/Activity";
import type { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import { AppError } from "../../../shared/errors/AppError";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export interface GetActivityBySlugInput {
  slug: string;
  userId: string;
  isAdmin: boolean;
}

export interface ActivityVersionDetails {
  versionNumber: number;
  name: string;
  description: string | null;
  difficulty: ActivityVersion["difficulty"];
  timeLimitSeconds: number | null;
  status: ActivityVersion["status"];
  revision: number;
  content: Record<string, unknown>;
  generatedData: Record<string, unknown> | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  reviewFeedback: string | null;
}

export interface GetActivityBySlugResponse {
  slug: string;
  type: Activity["type"];
  status: Activity["status"];
  visibility: Activity["visibility"];
  executionCount: number;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  version: ActivityVersionDetails;
}

export class GetActivityBySlugService {
  constructor(
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(
    input: GetActivityBySlugInput,
  ): Promise<GetActivityBySlugResponse> {
    const activity =
      await this.activityRepository.findBySlugWithVersions(
        input.slug,
      );

    if (!activity) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    const isOwner = activity.teacherId === input.userId;
    const canViewAllVersions = isOwner || input.isAdmin;

    let selectedVersion: ActivityVersion | undefined;

    if (canViewAllVersions) {
      selectedVersion = [...(activity.versions ?? [])].sort(
        (a, b) => b.versionNumber - a.versionNumber,
      )[0];
    } else {
      const hasPublishedActivity =
        activity.status === ActivityStatus.PUBLISHED &&
        activity.currentPublishedVersionId !== null;

      if (!hasPublishedActivity) {
        throw new AppError(
          "ACTIVITY_NOT_FOUND",
          404,
          "Atividade não encontrada.",
        );
      }

      selectedVersion = activity.versions?.find(
        (version) =>
          version.id === activity.currentPublishedVersionId &&
          version.status === ActivityVersionStatus.PUBLISHED,
      );

      if (!selectedVersion) {
        throw new AppError(
          "ACTIVITY_NOT_FOUND",
          404,
          "Atividade não encontrada.",
        );
      }
    }

    if (!selectedVersion) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_FOUND",
        404,
        "Nenhuma versão disponível foi encontrada para esta atividade.",
      );
    }

    return {
      slug: activity.slug,
      type: activity.type,
      status: activity.status,
      visibility: activity.visibility,
      executionCount: activity.executionCount,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      isOwner,
      version: {
        versionNumber: selectedVersion.versionNumber,
        name: selectedVersion.name,
        description: selectedVersion.description,
        difficulty: selectedVersion.difficulty,
        timeLimitSeconds: selectedVersion.timeLimitSeconds,
        status: selectedVersion.status,
        revision: selectedVersion.revision,
        content: selectedVersion.content,
        generatedData: selectedVersion.generatedData,
        submittedAt: selectedVersion.submittedAt,
        publishedAt: selectedVersion.publishedAt,
        reviewFeedback: selectedVersion.reviewFeedback,
      },
    };
  }
}