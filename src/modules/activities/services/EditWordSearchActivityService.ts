import type { EntityManager } from "typeorm";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { wordSearchContentSchema } from "../schemas/content/wordSearchContent.schema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { generateWordSearchPuzzle } from "../utils/wordSearch/generateWordSearchPuzzle";
import type { WordSearchGeneratedData } from "../types/wordSearch/WordSearchGeneratedData";
import { WordSearchPlacementError } from "../errors/WordSearchPlacementError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import type { CreateWordSearchActivityBody } from "../schemas/createWordSearchActivitySchema";
import { ActivityType } from "../types/ActivityType";

interface EditWordSearchActivityInput extends CreateWordSearchActivityBody {
  slug: string;
  teacherId: string;
}

interface EditWordSearchActivityResult {
  activity: Activity;
  version: ActivityVersion;
  preview: {
    grid: string[][];
    words: string[];
  };
}

export class EditWordSearchActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: EditWordSearchActivityInput,
  ): Promise<EditWordSearchActivityResult> {
    const activity = await this.findEditableActivity(
      input.slug,
      input.teacherId,
    );

    const versions = activity.versions ?? [];

    if (
      versions.some(
        (version) =>
          version.status === ActivityVersionStatus.PENDING_REVIEW,
      )
    ) {
      throw new AppError(
        "ACTIVITY_VERSION_PENDING_REVIEW",
        409,
        "A atividade possui uma versão aguardando revisão e não pode ser editada.",
      );
    }

    const validatedContent = wordSearchContentSchema.safeParse({
      words: input.words,
    });

    if (!validatedContent.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        400,
        "As palavras informadas para o caça-palavras são inválidas.",
      );
    }

    let generatedData: WordSearchGeneratedData;

    try {
      generatedData = generateWordSearchPuzzle(
        validatedContent.data.words,
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

    const latestVersion = [...versions].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    )[0];

    const editableVersion = [...versions]
      .filter(
        (version) =>
          version.status === ActivityVersionStatus.DRAFT ||
          version.status === ActivityVersionStatus.REJECTED ||
          version.status === ActivityVersionStatus.CHANGES_REQUESTED,
      )
      .sort(
        (first, second) => second.versionNumber - first.versionNumber,
      )[0];

    const version = editableVersion ?? new ActivityVersion();

    if (!editableVersion) {
      version.activityId = activity.id;
      version.versionNumber = latestVersion
        ? latestVersion.versionNumber + 1
        : 1;
      version.revision = 1;
      version.publishedAt = null;
    } else {
      version.revision += 1;
    }

    version.name = input.name.trim();
    version.description = input.description?.trim() || null;
    version.difficulty = input.difficulty;
    version.timeLimitSeconds =
      input.timeLimitSeconds === undefined
        ? DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS
        : input.timeLimitSeconds;
    version.content = {
      words: validatedContent.data.words,
    };
    version.generatedData = {
      grid: generatedData.grid,
      wordPositions: generatedData.wordPositions,
    };
    version.status = ActivityVersionStatus.DRAFT;
    version.submittedAt = null;
    version.reviewFeedback = null;
    version.reviewedAt = null;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      version,
    );

    return {
      activity,
      version: savedVersion,
      preview: {
        grid: generatedData.grid,
        words: validatedContent.data.words,
      },
    };
  }

  private async findEditableActivity(
    slug: string,
    teacherId: string,
  ): Promise<Activity> {
    const activity = await this.activityRepository.findBySlugWithVersions(
      slug,
    );

    if (
      !activity ||
      activity.deletedAt !== null ||
      activity.teacherId !== teacherId
    ) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    if (activity.type !== ActivityType.WORD_SEARCH) {
      throw new AppError(
        "ACTIVITY_TYPE_NOT_SUPPORTED",
        422,
        "A edição está disponível apenas para atividades do tipo caça-palavras.",
      );
    }

    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError(
        "ACTIVITY_NOT_EDITABLE",
        409,
        "Atividades arquivadas não podem ser editadas.",
      );
    }

    return activity;
  }
}