import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { quizContentSchema } from "../schemas/content/quizContentSchema";
import type { CreateQuizActivityBody } from "../schemas/createQuizActivitySchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

interface EditQuizActivityInput extends CreateQuizActivityBody {
  slug: string;
  teacherId: string;
  isAdmin: boolean;
}

export interface EditQuizActivityResult {
  activity: Activity;
  version: ActivityVersion;
}

export class EditQuizActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(input: EditQuizActivityInput): Promise<EditQuizActivityResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);

    if (!activity || activity.deletedAt !== null || activity.teacherId !== input.teacherId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }

    if (activity.type !== ActivityType.QUIZ) {
      throw new AppError("ACTIVITY_TYPE_NOT_SUPPORTED", 422, "Esta atividade não é um Quiz.");
    }

    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError("ACTIVITY_NOT_EDITABLE", 409, "Atividades arquivadas não podem ser editadas.");
    }

    const versions = activity.versions ?? [];
    if (versions.some((version) => version.status === ActivityVersionStatus.PENDING_REVIEW)) {
      throw new AppError(
        "ACTIVITY_VERSION_PENDING_REVIEW",
        409,
        "O Quiz possui uma versão aguardando revisão e não pode ser editado.",
      );
    }

    const validatedContent = quizContentSchema.safeParse(input.content);
    if (!validatedContent.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        400,
        "As questões e alternativas do Quiz são inválidas.",
      );
    }

    const latestVersion = [...versions].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    )[0];
    const editableVersion = [...versions]
      .filter((version) => [
        ActivityVersionStatus.DRAFT,
        ActivityVersionStatus.REJECTED,
        ActivityVersionStatus.CHANGES_REQUESTED,
      ].includes(version.status))
      .sort((first, second) => second.versionNumber - first.versionNumber)[0];

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

    if (input.isAdmin) {
      version.status = ActivityVersionStatus.PUBLISHED;
      version.publishedAt = new Date();
    } else {
      version.status = ActivityVersionStatus.DRAFT;
      version.publishedAt = null;
    }

    const savedVersion = await this.activityVersionRepository.save(this.manager, version);

    if (input.isAdmin) {
      await this.activityRepository.updatePublishedVersion(this.manager, activity.id, savedVersion.id);
      activity.status = ActivityStatus.PUBLISHED;
      activity.currentPublishedVersionId = savedVersion.id;
    }

    return { activity, version: savedVersion };
  }
}
