import { AppError } from "../../../shared/errors/AppError";
import type { IUserRepository } from "../../users/repositories/interfaces/IUserRepository";
import type { ListeningAttempt } from "../entities/ListeningAttempt";
import type { Activity } from "../entities/Activity";
import type { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IListeningAttemptRepository } from "../repositories/interfaces/IListeningAttemptRepository";
import { listeningDraftContentSchema } from "../schemas/content/listeningContentSchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export interface SubmitListeningAnswerInput {
  passageId: string;
  blankId: string;
  answer: string;
}

export interface SubmitListeningAttemptInput {
  slug: string;
  userId: string;
  answers: SubmitListeningAnswerInput[];
  elapsedSeconds: number;
}

export interface ListeningAttemptReview {
  passageId: string;
  blankId: string;
  answer: string;
  expectedAnswer: string;
  isCorrect: boolean;
}

export interface SubmitListeningAttemptResult {
  attempt: ListeningAttempt;
  totalBlanks: number;
  correctBlanks: number;
  review: ListeningAttemptReview[];
  ranking: ListeningAttempt[];
  isInRanking: boolean;
}

function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export class SubmitListeningAttemptService {
  constructor(
    private readonly attemptRepository: IListeningAttemptRepository,
    private readonly activityRepository: IActivityRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: SubmitListeningAttemptInput): Promise<SubmitListeningAttemptResult> {
    const activity: Activity | null = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (
      !activity ||
      activity.type !== ActivityType.LISTENING ||
      activity.status !== ActivityStatus.PUBLISHED ||
      !activity.currentPublishedVersionId
    ) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade de Listening publicada não encontrada.");
    }

    const version: ActivityVersion | undefined = activity.versions.find(
      (item) => item.id === activity.currentPublishedVersionId && item.status === ActivityVersionStatus.PUBLISHED,
    );
    if (!version) {
      throw new AppError("ACTIVITY_VERSION_NOT_FOUND", 404, "Versão publicada não encontrada.");
    }

    const parsedContent = listeningDraftContentSchema.safeParse(version.content);
    if (!parsedContent.success) {
      throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "O conteúdo desta atividade de Listening é inválido.");
    }

    const passages = parsedContent.data.passages;
    if (
      passages.length === 0 ||
      passages.some((passage) => !passage.text.trim() || passage.blanks.length === 0 || passage.audio.status !== "READY" || !passage.audio.storageKey)
    ) {
      throw new AppError("LISTENING_NOT_READY", 422, "Esta atividade ainda não está pronta para execução.");
    }

    const expectedBlanks = passages.flatMap((passage) =>
      passage.blanks.map((blank) => ({
        passageId: passage.id,
        blankId: blank.id,
        expectedAnswer: blank.expectedAnswer,
        alternatives: blank.alternatives,
      })),
    );
    const expectedKeys = new Set(expectedBlanks.map((blank) => `${blank.passageId}:${blank.blankId}`));
    const suppliedAnswers = new Map<string, string>();

    for (const answer of input.answers) {
      const key = `${answer.passageId}:${answer.blankId}`;
      if (!expectedKeys.has(key)) {
        throw new AppError("INVALID_LISTENING_ANSWER", 400, "A tentativa contém uma lacuna inválida.");
      }
      if (suppliedAnswers.has(key)) {
        throw new AppError("DUPLICATE_LISTENING_ANSWER", 400, "A tentativa contém respostas duplicadas.");
      }
      suppliedAnswers.set(key, answer.answer);
    }

    const review: ListeningAttemptReview[] = expectedBlanks.map((blank) => {
      const key = `${blank.passageId}:${blank.blankId}`;
      const answer = suppliedAnswers.get(key) ?? "";
      const acceptableAnswers = [blank.expectedAnswer, ...blank.alternatives];
      const isCorrect = acceptableAnswers.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(answer));
      return {
        passageId: blank.passageId,
        blankId: blank.blankId,
        answer,
        expectedAnswer: blank.expectedAnswer,
        isCorrect,
      };
    });

    const totalBlanks = review.length;
    const correctBlanks = review.filter((answer) => answer.isCorrect).length;
    const score = totalBlanks > 0 ? Math.round((correctBlanks / totalBlanks) * 100) : 0;
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new AppError("USER_NOT_FOUND", 404, "Usuário não encontrado.");

    const attempt = await this.attemptRepository.create({
      activityId: activity.id,
      activityVersionId: version.id,
      userId: user.id,
      studentName: user.name,
      answers: review.map(({ passageId, blankId, answer, isCorrect }) => ({
        passageId,
        blankId,
        answer,
        isCorrect,
      })),
      totalBlanks,
      correctBlanks,
      elapsedSeconds: input.elapsedSeconds,
      score,
    });
    const ranking = await this.attemptRepository.getRanking(activity.id);

    return {
      attempt,
      totalBlanks,
      correctBlanks,
      review,
      ranking,
      isInRanking: ranking.some((entry) => entry.id === attempt.id),
    };
  }
}
