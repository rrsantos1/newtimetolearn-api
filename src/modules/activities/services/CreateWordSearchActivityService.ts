import type { EntityManager } from "typeorm";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { wordSearchContentSchema } from "../schemas/content/wordSearchContent.schema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { generateActivitySlug } from "../utils/generateActivitySlug";
import { generateWordSearchPuzzle } from "../utils/wordSearch/generateWordSearchPuzzle";
import { CreateWordSearchActivityInput } from "../types/wordSearch/CreateWordSearchActivityInput";
import { WordSearchGeneratedData } from "../types/wordSearch/WordSearchGeneratedData";
import { AppError } from "../../../shared/errors/AppError";
import { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { WordSearchPlacementError } from "../errors/WordSearchPlacementError";

interface CreateWordSearchActivityResult {
  activity: Activity;
  version: ActivityVersion;
  preview: {
    grid: string[][];
    words: string[];
  };
}

export class CreateWordSearchActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: CreateWordSearchActivityInput,
  ): Promise<CreateWordSearchActivityResult> {
    const validatedContent = wordSearchContentSchema.parse({
      words: input.words,
    });

    let generatedData: WordSearchGeneratedData;

    try {
        generatedData = generateWordSearchPuzzle(
            validatedContent.words,
            input.difficulty,
        );
        } catch (error: unknown) {
        if (error instanceof RangeError) {
            throw new AppError(
            "WORD_SEARCH_WORD_TOO_LONG",
            400,
            "Uma das palavras excede o limite permitido para o caça-palavras.",
            );
        }

        if (error instanceof WordSearchPlacementError) {
            throw new AppError(
            "WORD_SEARCH_GENERATION_FAILED",
            422,
            "Não foi possível gerar o caça-palavras com as palavras informadas.",
            );
        }

        throw error;
    }

    const slug = await this.generateUniqueSlug(input.name);

    const activity = new Activity();

    activity.teacherId = input.teacherId;
    activity.type = ActivityType.WORD_SEARCH;
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
    version.description = input.description?.trim() || null;
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
      wordPositions: generatedData.wordPositions,
    };
    version.status = input.isAdmin
        ? ActivityVersionStatus.PUBLISHED
        : ActivityVersionStatus.DRAFT;
    version.revision = 1;
    version.submittedAt = null;
    version.publishedAt = null;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      version,
    );

    return {
      activity: savedActivity,
      version: savedVersion,
      preview: {
        grid: generatedData.grid,
        words: validatedContent.words,
      },
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const MAX_ATTEMPTS = 100;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const slug =
        attempt === 1
          ? generateActivitySlug(name)
          : generateActivitySlug(name, attempt);

      const existingActivity =
        await this.activityRepository.findBySlug(slug);

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