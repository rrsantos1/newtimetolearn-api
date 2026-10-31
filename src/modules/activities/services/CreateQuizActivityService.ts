import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { quizDraftContentSchema } from "../schemas/content/quizContentSchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { generateActivitySlug } from "../utils/generateActivitySlug";
import type { CreateQuizActivityInput } from "../types/quiz/CreateQuizActivityInput";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";

export class CreateQuizActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(input: CreateQuizActivityInput) {
    const content = quizDraftContentSchema.parse(input.content);
    const slug = await this.generateUniqueSlug(input.name);
    const activity = new Activity();

    activity.teacherId = input.teacherId;
    activity.type = ActivityType.QUIZ;
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
    version.content = content;
    version.generatedData = null;
    version.status = input.isAdmin
      ? ActivityVersionStatus.PUBLISHED
      : ActivityVersionStatus.DRAFT;
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
    const maxAttempts = 100;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const slug = attempt === 1
        ? generateActivitySlug(name)
        : generateActivitySlug(name, attempt);
      const existingActivity = await this.activityRepository.findBySlug(slug);

      if (!existingActivity) {
        return slug;
      }
    }

    throw new AppError(
      "ACTIVITY_SLUG_GENERATION_FAILED",
      500,
      "Não foi possível gerar um identificador único para a atividade.",
    );
  }
}
