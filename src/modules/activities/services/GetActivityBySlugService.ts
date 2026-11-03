import type { Activity } from "../entities/Activity";
import type { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import { AppError } from "../../../shared/errors/AppError";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { ActivityType } from "../types/ActivityType";
import { sanitizeCrosswordForExecution } from "../utils/crossword/sanitizeCrosswordForExecution";
import { createDragDropExecutionToken } from "../utils/createDragDropExecutionToken";

function sanitizeListeningForExecution(content: Record<string, unknown>): Record<string, unknown> {
  const passages = Array.isArray(content.passages) ? content.passages : [];
  return {
    ...content,
    passages: passages.map((passage) => {
      if (typeof passage !== "object" || passage === null || Array.isArray(passage)) return passage;
      const passageRecord = passage as Record<string, unknown>;
      const blanks = Array.isArray(passageRecord.blanks) ? passageRecord.blanks : [];
      return {
        ...passageRecord,
        blanks: blanks.map((blank) => {
          if (typeof blank !== "object" || blank === null || Array.isArray(blank)) return blank;
          return Object.fromEntries(
            Object.entries(blank as Record<string, unknown>).filter(([key]) => key !== "expectedAnswer" && key !== "alternatives"),
          );
        }),
      };
    }),
  };
}

function sanitizeDragDropForExecution(
  activityType: ActivityType.WORD_MATCHING | ActivityType.SENTENCE_COMPLETION,
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (activityType === ActivityType.WORD_MATCHING) {
    const pairs = Array.isArray(content.pairs) ? content.pairs : [];
    return {
      pairs: pairs.map((value) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
        const pair = value as Record<string, unknown>;
        const pairId = typeof pair.id === "string" ? pair.id : "";
        const source = typeof pair.source === "object" && pair.source !== null ? pair.source as Record<string, unknown> : {};
        const target = typeof pair.target === "object" && pair.target !== null ? pair.target as Record<string, unknown> : {};
        return {
          source: { ...source, id: createDragDropExecutionToken(pairId, "source") },
          target: { ...target, id: createDragDropExecutionToken(pairId, "target") },
        };
      }),
    };
  }

  const words = Array.isArray(content.words) ? content.words : [];
  const sentences = Array.isArray(content.sentences) ? content.sentences : [];
  return {
    words,
    sentences: sentences.map((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
      const sentence = value as Record<string, unknown>;
      const blanks = Array.isArray(sentence.blanks) ? sentence.blanks : [];
      return {
        ...sentence,
        blanks: blanks.map((blank) => {
          if (typeof blank !== "object" || blank === null || Array.isArray(blank)) return blank;
          const record = blank as Record<string, unknown>;
          return { id: record.id };
        }),
      };
    }),
  };
}

export interface GetActivityBySlugInput {
  slug: string;
  userId: string;
  isAdmin: boolean;
}

export interface ActivityVersionDetails {
  versionNumber: number;
  name: string;
  description: string | null;
  difficulty: ActivityVersion["difficulty"];
  timeLimitSeconds: number | null;
  status: ActivityVersion["status"];
  revision: number;
  content: Record<string, unknown>;
  generatedData: Record<string, unknown> | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  reviewFeedback: string | null;
}

export interface GetActivityBySlugResponse {
  slug: string;
  type: Activity["type"];
  status: Activity["status"];
  visibility: Activity["visibility"];
  executionCount: number;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  coverMediaAssetId: string | null;
  coverImageUrl: string | null;
  coverAltText: string | null;
  version: ActivityVersionDetails;
}

export class GetActivityBySlugService {
  constructor(
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(
    input: GetActivityBySlugInput,
  ): Promise<GetActivityBySlugResponse> {
    const activity =
      await this.activityRepository.findBySlugWithVersions(
        input.slug,
      );

    if (!activity) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    const isOwner = activity.teacherId === input.userId;
    const canViewAllVersions = isOwner || input.isAdmin;

    let selectedVersion: ActivityVersion | undefined;

    if (canViewAllVersions) {
      selectedVersion = [...(activity.versions ?? [])].sort(
        (a, b) => b.versionNumber - a.versionNumber,
      )[0];
    } else {
      const hasPublishedActivity =
        activity.status === ActivityStatus.PUBLISHED &&
        activity.currentPublishedVersionId !== null;

      if (!hasPublishedActivity) {
        throw new AppError(
          "ACTIVITY_NOT_FOUND",
          404,
          "Atividade não encontrada.",
        );
      }

      selectedVersion = activity.versions?.find(
        (version) =>
          version.id === activity.currentPublishedVersionId &&
          version.status === ActivityVersionStatus.PUBLISHED,
      );

      if (!selectedVersion) {
        throw new AppError(
          "ACTIVITY_NOT_FOUND",
          404,
          "Atividade não encontrada.",
        );
      }
    }

    if (!selectedVersion) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_FOUND",
        404,
        "Nenhuma versão disponível foi encontrada para esta atividade.",
      );
    }

    const executionData =
      !canViewAllVersions && activity.type === ActivityType.CROSSWORD
        ? sanitizeCrosswordForExecution(selectedVersion.content, selectedVersion.generatedData)
        : !canViewAllVersions && activity.type === ActivityType.LISTENING
          ? { content: sanitizeListeningForExecution(selectedVersion.content), generatedData: selectedVersion.generatedData }
          : !canViewAllVersions && (activity.type === ActivityType.WORD_MATCHING || activity.type === ActivityType.SENTENCE_COMPLETION)
            ? { content: sanitizeDragDropForExecution(activity.type, selectedVersion.content), generatedData: selectedVersion.generatedData }
            : { content: selectedVersion.content, generatedData: selectedVersion.generatedData };

    return {
      slug: activity.slug,
      type: activity.type,
      status: activity.status,
      visibility: activity.visibility,
      executionCount: activity.executionCount,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      isOwner,
      coverMediaAssetId: activity.coverMediaAssetId ?? null,
      coverImageUrl: activity.coverMediaAsset?.status === "APPROVED" ? activity.coverMediaAsset.publicUrl : null,
      coverAltText: activity.coverMediaAsset?.status === "APPROVED" ? activity.coverMediaAsset.altText : null,
      version: {
        versionNumber: selectedVersion.versionNumber,
        name: selectedVersion.name,
        description: selectedVersion.description,
        difficulty: selectedVersion.difficulty,
        timeLimitSeconds: selectedVersion.timeLimitSeconds,
        status: selectedVersion.status,
        revision: selectedVersion.revision,
        content: executionData.content,
        generatedData: executionData.generatedData,
        submittedAt: selectedVersion.submittedAt,
        publishedAt: selectedVersion.publishedAt,
        reviewFeedback: selectedVersion.reviewFeedback,
      },
    };
  }
}