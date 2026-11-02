import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { memoryContentSchema } from "../schemas/content/memoryContentSchema";
import type { CreateMemoryActivityBody } from "../schemas/createMemoryActivitySchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

interface EditMemoryActivityInput extends CreateMemoryActivityBody {
  slug: string;
  teacherId: string;
  isAdmin: boolean;
}

export interface EditMemoryActivityResult {
  activity: Activity;
  version: ActivityVersion;
}

export class EditMemoryActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(input: EditMemoryActivityInput): Promise<EditMemoryActivityResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.deletedAt !== null || activity.teacherId !== input.teacherId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }
    if (activity.type !== ActivityType.MEMORY) {
      throw new AppError("ACTIVITY_TYPE_NOT_SUPPORTED", 422, "Esta atividade não é um jogo da memória.");
    }
    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError("ACTIVITY_NOT_EDITABLE", 409, "Atividades arquivadas não podem ser editadas.");
    }

    const versions = activity.versions ?? [];
    if (versions.some((version) => version.status === ActivityVersionStatus.PENDING_REVIEW)) {
      throw new AppError("ACTIVITY_VERSION_PENDING_REVIEW", 409, "A atividade possui uma versão aguardando revisão e não pode ser editada.");
    }

    const validatedContent = memoryContentSchema.safeParse(input.content);
    if (!validatedContent.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Os pares do jogo da memória são inválidos.");
    }

    const latestVersion = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const editableVersion = [...versions]
      .filter((version) => [
        ActivityVersionStatus.DRAFT,
        ActivityVersionStatus.REJECTED,
        ActivityVersionStatus.CHANGES_REQUESTED,
      ].includes(version.status))
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];

    const version = editableVersion ?? new ActivityVersion();
    if (!editableVersion) {
      version.activityId = activity.id;
      version.versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
      version.revision = 1;
    } else {
      version.revision += 1;
    }

    version.name = input.name.trim();
    const description = input.description?.trim();
    version.description = description && description.length > 0 ? description : null;
    version.difficulty = input.difficulty;
    version.timeLimitSeconds = input.timeLimitSeconds === undefined
      ? DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS
      : input.timeLimitSeconds;
    version.content = validatedContent.data;
    version.generatedData = null;
    version.submittedAt = null;
    version.reviewFeedback = null;
    version.reviewedAt = null;
    version.status = input.isAdmin ? ActivityVersionStatus.PUBLISHED : ActivityVersionStatus.DRAFT;
    version.publishedAt = input.isAdmin ? new Date() : null;

    const savedVersion = await this.activityVersionRepository.save(this.manager, version);
    if (input.isAdmin) {
      await this.activityRepository.updatePublishedVersion(this.manager, activity.id, savedVersion.id);
      activity.status = ActivityStatus.PUBLISHED;
      activity.currentPublishedVersionId = savedVersion.id;
    }
    return { activity, version: savedVersion };
  }
}
