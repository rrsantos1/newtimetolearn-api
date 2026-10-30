import type { EntityManager } from "typeorm";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { crosswordContentSchema } from "../schemas/content/crosswordContent.schema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { generateActivitySlug } from "../utils/generateActivitySlug";
import { generateCrosswordPuzzle } from "../utils/crossword/generateCrosswordPuzzle";
import { normalizeCrosswordAnswer } from "../utils/crossword/normalizeCrosswordAnswer";
import type { CrosswordRenderResult } from "../utils/crossword/render/CrosswordRenderer";
import type { CreateCrosswordActivityInput } from "../types/crossword/CreateCrosswordActivityInput";
import { AppError } from "../../../shared/errors/AppError";
import { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { CrosswordGenerationError } from "../errors/CrosswordGenerationError";

interface CreateCrosswordActivityResult {
  activity: Activity;
  version: ActivityVersion;
  preview: CrosswordRenderResult;
}

export class CreateCrosswordActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: CreateCrosswordActivityInput,
  ): Promise<CreateCrosswordActivityResult> {
    const validatedContent = crosswordContentSchema.parse({
      words: input.words,
    });

    let generatedData: CrosswordRenderResult;

    try {
      generatedData = generateCrosswordPuzzle(
        validatedContent.words.map((entry) => ({
          ...entry,
          word: normalizeCrosswordAnswer(entry.word).normalized,
        })),
        25,
        25,
      );
    } catch (error: unknown) {
      if (error instanceof CrosswordGenerationError) {
        throw new AppError(
          "CROSSWORD_GENERATION_FAILED",
          422,
          "Não foi possível gerar uma cruzadinha válida com as respostas informadas. Revise as palavras e tente novamente.",
        );
      }

      throw error;
    }

    const slug = await this.generateUniqueSlug(input.name);
    const activity = new Activity();

    activity.teacherId = input.teacherId;
    activity.type = ActivityType.CROSSWORD;
    activity.slug = slug;
    activity.status = ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    const savedActivity = await this.activityRepository.save(
      this.manager,
      activity,
    );

    const version = new ActivityVersion();
    version.activityId = savedActivity.id;
    version.versionNumber = 1;
    version.name = input.name.trim();
    const description = input.description?.trim();
    version.description =
      description && description.length > 0 ? description : null;
    version.difficulty = input.difficulty;
    version.timeLimitSeconds =
      input.timeLimitSeconds === undefined
        ? DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS
        : input.timeLimitSeconds;
    version.content = {
      words: validatedContent.words,
    };
    version.generatedData = {
      grid: generatedData.grid,
      clues: generatedData.clues,
    };
    version.status = input.isAdmin
      ? ActivityVersionStatus.PUBLISHED
      : ActivityVersionStatus.DRAFT;
    version.revision = 1;
    version.submittedAt = null;
    version.publishedAt = input.isAdmin ? new Date() : null;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      version,
    );

    if (input.isAdmin) {
      savedActivity.status = ActivityStatus.PUBLISHED;
      savedActivity.currentPublishedVersionId = savedVersion.id;
      await this.activityRepository.save(this.manager, savedActivity);
    }

    return {
      activity: savedActivity,
      version: savedVersion,
      preview: generatedData,
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const MAX_ATTEMPTS = 100;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const slug =
        attempt === 1
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
