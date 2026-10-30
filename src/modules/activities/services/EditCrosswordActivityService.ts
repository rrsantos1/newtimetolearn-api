import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import { CrosswordGenerationError } from "../errors/CrosswordGenerationError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { crosswordContentSchema } from "../schemas/content/crosswordContent.schema";
import type { CreateCrosswordActivityBody } from "../schemas/createCrosswordActivitySchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { generateCrosswordPuzzle } from "../utils/crossword/generateCrosswordPuzzle";
import { normalizeCrosswordAnswer } from "../utils/crossword/normalizeCrosswordAnswer";
import type { CrosswordRenderResult } from "../utils/crossword/render/CrosswordRenderer";

interface EditCrosswordActivityInput extends CreateCrosswordActivityBody {
  slug: string;
  teacherId: string;
  isAdmin: boolean;
}

interface EditCrosswordActivityResult {
  activity: Activity;
  version: ActivityVersion;
  preview: CrosswordRenderResult;
}

export class EditCrosswordActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: EditCrosswordActivityInput,
  ): Promise<EditCrosswordActivityResult> {
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

    const validatedContent = crosswordContentSchema.safeParse({
      words: input.words,
    });

    if (!validatedContent.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        400,
        "As respostas e pistas informadas para a cruzadinha são inválidas.",
      );
    }

    let generatedData: CrosswordRenderResult;

    try {
      generatedData = generateCrosswordPuzzle(
        validatedContent.data.words.map((entry) => ({
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
    } else {
      version.revision += 1;
    }

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
      words: validatedContent.data.words,
    };
    version.generatedData = {
      grid: generatedData.grid,
      clues: generatedData.clues,
    };

    if (input.isAdmin) {
      version.status = ActivityVersionStatus.PUBLISHED;
      version.publishedAt = new Date();
      version.reviewFeedback = null;
      version.reviewedAt = null;
    } else {
      version.status = ActivityVersionStatus.DRAFT;
      version.publishedAt = null;
    }

    version.submittedAt = null;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      version,
    );

    if (input.isAdmin) {
      await this.activityRepository.updatePublishedVersion(
        this.manager,
        activity.id,
        savedVersion.id,
      );

      activity.status = ActivityStatus.PUBLISHED;
      activity.currentPublishedVersionId = savedVersion.id;
    }

    return {
      activity,
      version: savedVersion,
      preview: generatedData,
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

    if (activity.type !== ActivityType.CROSSWORD) {
      throw new AppError(
        "ACTIVITY_TYPE_NOT_SUPPORTED",
        422,
        "A edição está disponível apenas para atividades do tipo cruzadinha.",
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
