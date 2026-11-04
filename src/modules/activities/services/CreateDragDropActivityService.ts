import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { wordMatchingContentSchema } from "../schemas/content/wordMatchingContentSchema";
import { sentenceCompletionContentSchema } from "../schemas/content/sentenceCompletionContentSchema";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { generateActivitySlug } from "../utils/generateActivitySlug";
import type { CreateDragDropActivityBody } from "../schemas/createDragDropActivitySchema";

export type DragDropActivityType = ActivityType.WORD_MATCHING | ActivityType.MULTIPLE_CHOICE | ActivityType.SENTENCE_COMPLETION;

interface Input extends CreateDragDropActivityBody {
  teacherId: string;
  isAdmin: boolean;
}

export class CreateDragDropActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
    private readonly activityType: DragDropActivityType,
  ) {}

  async execute(input: Input) {
    const parsedContent = this.activityType === ActivityType.WORD_MATCHING || this.activityType === ActivityType.MULTIPLE_CHOICE
      ? wordMatchingContentSchema.safeParse(input.content)
      : sentenceCompletionContentSchema.safeParse(input.content);

    if (!parsedContent.success) {
      throw new AppError("VALIDATION_ERROR", 400, "O conteúdo da atividade é inválido.");
    }

    const slug = await this.generateUniqueSlug(input.name);
    const activity = new Activity();
    activity.teacherId = input.teacherId;
    activity.type = this.activityType;
    activity.slug = slug;
    activity.status = input.isAdmin ? ActivityStatus.PUBLISHED : ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    const savedActivity = await this.activityRepository.save(this.manager, activity);
    const version = new ActivityVersion();
    version.activityId = savedActivity.id;
    version.versionNumber = 1;
    version.name = input.name.trim();
    const description = input.description?.trim();
    version.description = description && description.length > 0 ? description : null;
    version.difficulty = input.difficulty;
    version.timeLimitSeconds = input.timeLimitSeconds === undefined
      ? DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS
      : input.timeLimitSeconds;
    version.content = parsedContent.data;
    version.generatedData = null;
    version.status = input.isAdmin ? ActivityVersionStatus.PUBLISHED : ActivityVersionStatus.DRAFT;
    version.revision = 1;
    version.submittedAt = null;
    version.publishedAt = input.isAdmin ? new Date() : null;

    const savedVersion = await this.activityVersionRepository.save(this.manager, version);
    if (input.isAdmin) {
      savedActivity.currentPublishedVersionId = savedVersion.id;
      await this.activityRepository.save(this.manager, savedActivity);
    }

    return { activity: savedActivity, version: savedVersion };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      const slug = attempt === 1
        ? generateActivitySlug(name)
        : generateActivitySlug(name, attempt);
      if (!(await this.activityRepository.findBySlug(slug))) return slug;
    }
    throw new AppError("ACTIVITY_SLUG_GENERATION_FAILED", 500, "Não foi possível gerar um identificador único para a atividade.");
  }
}
