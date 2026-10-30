import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { AppError } from "../../../shared/errors/AppError";
import {
  IActivityRepository,
  ListActivitiesResult,
} from "../repositories/interfaces/IActivityRepository";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export interface ListActivitiesInput {
  page: number;
  limit: number;
  teacherId?: string;
  scope: "mine" | "explore" | "all";
}

export interface ListedActivity {
  slug: string;
  type: Activity["type"];
  status: Activity["status"];
  visibility: Activity["visibility"];
  executionCount: number;
  createdAt: Date;
  requiresApproval: boolean;
  latestVersion: {
    versionNumber: number;
    name: string;
    description: string | null;
    difficulty: ActivityVersion["difficulty"];
    timeLimitSeconds: number | null;
    status: ActivityVersion["status"];
    revision: number;
  } | null;
  publishedVersion: {
    versionNumber: number;
    name: string;
  } | null;
}

export interface ListActivitiesResponse {
  items: ListedActivity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ListActivitiesService {
  constructor(
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(
    input: ListActivitiesInput,
  ): Promise<ListActivitiesResponse> {
    if (
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new AppError(
        "INVALID_PAGINATION",
        400,
        "Os parâmetros de paginação são inválidos.",
      );
    }

    if (input.scope !== "all" && !input.teacherId) {
      throw new AppError(
        "TEACHER_ID_REQUIRED",
        400,
        "O identificador do professor é obrigatório.",
      );
    }

    const result: ListActivitiesResult =
      await this.activityRepository.list(input);

    const items = result.items.map((activity) => {
      const versions = activity.versions ?? [];

      const latestVersion = [...versions].sort(
        (a, b) => b.versionNumber - a.versionNumber,
      )[0];

      const publishedVersion = versions.find(
        (version) => version.id === activity.currentPublishedVersionId
          && version.status === ActivityVersionStatus.PUBLISHED,
      );

      return {
        slug: activity.slug,
        type: activity.type,
        status: activity.status,
        visibility: activity.visibility,
        executionCount: activity.executionCount,
        requiresApproval: activity.status !== "ARCHIVED" && latestVersion?.status === ActivityVersionStatus.DRAFT,
        createdAt: activity.createdAt,
        latestVersion: latestVersion
          ? {
              versionNumber: latestVersion.versionNumber,
              name: latestVersion.name,
              description: latestVersion.description,
              difficulty: latestVersion.difficulty,
              timeLimitSeconds: latestVersion.timeLimitSeconds,
              status: latestVersion.status,
              revision: latestVersion.revision,
            }
          : null,
        publishedVersion: publishedVersion
          ? {
              versionNumber: publishedVersion.versionNumber,
              name: publishedVersion.name,
            }
          : null,
      };
    });

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }
}