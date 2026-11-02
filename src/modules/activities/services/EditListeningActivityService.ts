import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { DEFAULT_ACTIVITY_TIME_LIMIT_SECONDS } from "../constants/activityDefaults";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { listeningDraftContentSchema } from "../schemas/content/listeningContentSchema";
import type { CreateListeningActivityBody } from "../schemas/createListeningActivitySchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

interface EditListeningActivityInput extends CreateListeningActivityBody {
  slug: string;
  teacherId: string;
  isAdmin: boolean;
}

export interface EditListeningActivityResult {
  activity: Activity;
  version: ActivityVersion;
}

export class EditListeningActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(input: EditListeningActivityInput): Promise<EditListeningActivityResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.deletedAt !== null || activity.teacherId !== input.teacherId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }
    if (activity.type !== ActivityType.LISTENING) {
      throw new AppError("ACTIVITY_TYPE_NOT_SUPPORTED", 422, "Esta atividade não é um Listening.");
    }
    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError("ACTIVITY_NOT_EDITABLE", 409, "Atividades arquivadas não podem ser editadas.");
    }

    const versions = activity.versions ?? [];
    if (versions.some((version) => version.status === ActivityVersionStatus.PENDING_REVIEW)) {
      throw new AppError("ACTIVITY_VERSION_PENDING_REVIEW", 409, "O Listening possui uma versão aguardando revisão e não pode ser editado.");
    }

    const validatedContent = listeningDraftContentSchema.safeParse(input.content);
    if (!validatedContent.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Os textos, lacunas ou áudios do Listening são inválidos.");
    }

    const latestVersion = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const editableVersion = [...versions]
      .filter((version) => [
        ActivityVersionStatus.DRAFT,
        ActivityVersionStatus.REJECTED,
        ActivityVersionStatus.CHANGES_REQUESTED,
      ].includes(version.status))
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];

    const previousContent = editableVersion
      ? listeningDraftContentSchema.safeParse(editableVersion.content)
      : null;
    const previousPassages = previousContent?.success ? previousContent.data.passages : [];
    const sanitizedContent = {
      ...validatedContent.data,
      passages: validatedContent.data.passages.map((passage) => {
        const previousPassage = previousPassages.find((item) => item.id === passage.id);
        if (previousPassage && previousPassage.text === passage.text) {
          return { ...passage, audio: previousPassage.audio };
        }
        return {
          ...passage,
          audio: {
            storageKey: null,
            publicUrl: null,
            status: previousPassage?.audio.storageKey ? "STALE" as const : "PENDING" as const,
            model: null,
            voice: null,
            textHash: null,
            durationSeconds: null,
          },
        };
      }),
    };

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
    version.content = sanitizedContent;
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
