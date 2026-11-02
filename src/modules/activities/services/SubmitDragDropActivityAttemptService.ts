import { AppError } from "../../../shared/errors/AppError";
import type { IUserRepository } from "../../users/repositories/interfaces/IUserRepository";
import type { ActivityAttempt } from "../entities/ActivityAttempt";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";
import { sentenceCompletionContentSchema } from "../schemas/content/sentenceCompletionContentSchema";
import { wordMatchingContentSchema } from "../schemas/content/wordMatchingContentSchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { createDragDropExecutionToken } from "../utils/createDragDropExecutionToken";
import type { DragDropActivityType } from "./CreateDragDropActivityService";

export interface DragDropAnswer {
  itemId: string;
  selectedId: string;
}

export interface SubmitDragDropAttemptInput {
  slug: string;
  userId: string;
  answers: DragDropAnswer[];
  elapsedSeconds: number;
}

export interface SubmitDragDropAttemptResult {
  attempt: ActivityAttempt;
  ranking: ActivityAttempt[];
  isInRanking: boolean;
  correctCount: number;
  totalItems: number;
  corrections: Array<{ itemId: string; selectedId: string | null; expectedId: string; isCorrect: boolean }>;
}

export class SubmitDragDropActivityAttemptService {
  constructor(
    private readonly attemptRepository: IActivityAttemptRepository,
    private readonly activityRepository: IActivityRepository,
    private readonly userRepository: IUserRepository,
    private readonly activityType: DragDropActivityType,
  ) {}

  async execute(input: SubmitDragDropAttemptInput): Promise<SubmitDragDropAttemptResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.type !== this.activityType || activity.status !== ActivityStatus.PUBLISHED || !activity.currentPublishedVersionId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade publicada não encontrada.");
    }

    const version = activity.versions.find((entry) => entry.id === activity.currentPublishedVersionId && entry.status === ActivityVersionStatus.PUBLISHED);
    if (!version) throw new AppError("ACTIVITY_VERSION_NOT_FOUND", 404, "Versão publicada não encontrada.");

    const content = this.activityType === ActivityType.WORD_MATCHING
      ? wordMatchingContentSchema.safeParse(version.content)
      : sentenceCompletionContentSchema.safeParse(version.content);
    if (!content.success) throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "O conteúdo da atividade é inválido.");

    const expected = new Map<string, string>();
    if (this.activityType === ActivityType.WORD_MATCHING && "pairs" in content.data) {
      content.data.pairs.forEach((pair) => expected.set(
        createDragDropExecutionToken(pair.id, "source"),
        createDragDropExecutionToken(pair.id, "target"),
      ));
    } else if ("sentences" in content.data) {
      content.data.sentences.forEach((sentence) => sentence.blanks.forEach((blank) => expected.set(blank.id, blank.expectedWordId)));
    }

    const uniqueItemAnswers = new Map<string, string>();
    const usedSelections = new Set<string>();
    for (const answer of input.answers) {
      if (!expected.has(answer.itemId) || uniqueItemAnswers.has(answer.itemId)) continue;
      if (usedSelections.has(answer.selectedId)) continue;
      uniqueItemAnswers.set(answer.itemId, answer.selectedId);
      usedSelections.add(answer.selectedId);
    }

    const correctIds = [...expected.entries()]
      .filter(([itemId, expectedId]) => uniqueItemAnswers.get(itemId) === expectedId)
      .map(([itemId]) => itemId);
    const totalItems = expected.size;
    const correctCount = correctIds.length;
    const elapsedSeconds = Math.max(0, Math.min(86_400, Math.floor(input.elapsedSeconds)));
    const accuracyPoints = totalItems > 0 ? Math.round((correctCount / totalItems) * 80) : 0;
    const speedPoints = version.timeLimitSeconds === null
      ? 0
      : Math.round(Math.max(0, 1 - elapsedSeconds / Math.max(1, version.timeLimitSeconds)) * 20);
    const score = Math.max(0, Math.min(100, accuracyPoints + speedPoints));
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new AppError("USER_NOT_FOUND", 404, "Usuário não encontrado.");

    const attempt = await this.attemptRepository.create({
      activityId: activity.id,
      activityVersionId: version.id,
      userId: user.id,
      studentName: user.name,
      wordsFound: correctIds,
      totalWords: totalItems,
      elapsedSeconds,
      score,
      accuracyPoints,
      speedPoints,
    });
    const ranking = await this.attemptRepository.getRanking(activity.id);
    const corrections = [...expected.entries()].map(([itemId, expectedId]) => {
      const selectedId = uniqueItemAnswers.get(itemId) ?? null;
      return { itemId, selectedId, expectedId, isCorrect: selectedId === expectedId };
    });
    return { attempt, ranking, isInRanking: ranking.some((entry) => entry.id === attempt.id), correctCount, totalItems, corrections };
  }
}
