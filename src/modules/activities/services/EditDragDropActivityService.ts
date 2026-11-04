import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { sentenceCompletionContentSchema } from "../schemas/content/sentenceCompletionContentSchema";
import { wordMatchingContentSchema } from "../schemas/content/wordMatchingContentSchema";
import type { CreateDragDropActivityBody } from "../schemas/createDragDropActivitySchema";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import type { DragDropActivityType } from "./CreateDragDropActivityService";

interface Input extends CreateDragDropActivityBody {
  slug: string;
  teacherId: string;
  isAdmin: boolean;
}

export class EditDragDropActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
    private readonly activityType: DragDropActivityType,
  ) {}

  async execute(input: Input) {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.deletedAt !== null || activity.teacherId !== input.teacherId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }
    if (activity.type !== this.activityType) {
      throw new AppError("ACTIVITY_TYPE_NOT_SUPPORTED", 422, "O tipo da atividade não corresponde à edição solicitada.");
    }
    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError("ACTIVITY_NOT_EDITABLE", 409, "Atividades arquivadas não podem ser editadas.");
    }

    const versions = activity.versions ?? [];
    if (versions.some((version) => version.status === ActivityVersionStatus.PENDING_REVIEW)) {
      throw new AppError("ACTIVITY_VERSION_PENDING_REVIEW", 409, "A atividade possui uma versão aguardando revisão e não pode ser editada.");
    }

    const parsedContent = this.activityType === ActivityType.WORD_MATCHING || this.activityType === ActivityType.MULTIPLE_CHOICE
      ? wordMatchingContentSchema.safeParse(input.content)
      : sentenceCompletionContentSchema.safeParse(input.content);
    if (!parsedContent.success) {
      throw new AppError("VALIDATION_ERROR", 400, "O conteúdo da atividade é inválido.");
    }

    const latestVersion = [...versions].sort((first, second) => second.versionNumber - first.versionNumber)[0];
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
    version.content = parsedContent.data;
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
