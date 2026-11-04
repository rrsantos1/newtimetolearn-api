import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import { Activity } from "../entities/Activity";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { ActivityType } from "../types/ActivityType";
import { quizContentSchema } from "../schemas/content/quizContentSchema";
import { listeningDraftContentSchema } from "../schemas/content/listeningContentSchema";
import { wordMatchingContentSchema } from "../schemas/content/wordMatchingContentSchema";
import { sentenceCompletionContentSchema } from "../schemas/content/sentenceCompletionContentSchema";

interface SubmitActivityVersionInput {
  slug: string;
  teacherId: string;
}

interface SubmitActivityVersionResult {
  activity: Activity;
  version: ActivityVersion;
}

export class SubmitActivityVersionService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(
    input: SubmitActivityVersionInput,
  ): Promise<SubmitActivityVersionResult> {
    const activity =
      await this.activityRepository.findBySlugWithVersions(input.slug);

    if (
      !activity ||
      activity.deletedAt !== null ||
      activity.teacherId !== input.teacherId
    ) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    if (activity.status === ActivityStatus.ARCHIVED) {
      throw new AppError(
        "ACTIVITY_NOT_SUBMITTABLE",
        409,
        "Atividades arquivadas não podem ser enviadas para revisão.",
      );
    }

    const latestVersion = [...(activity.versions ?? [])].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    )[0];

    if (!latestVersion) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_FOUND",
        409,
        "A atividade não possui uma versão para envio.",
      );
    }

    if (latestVersion.status !== ActivityVersionStatus.DRAFT) {
      throw new AppError(
        "ACTIVITY_VERSION_NOT_SUBMITTABLE",
        409,
        "Somente a versão mais recente em rascunho pode ser enviada para revisão.",
      );
    }

    if (activity.type === ActivityType.LISTENING) {
      const validatedListening = listeningDraftContentSchema.safeParse(latestVersion.content);
      if (!validatedListening.success) {
        throw new AppError(
          "LISTENING_NOT_READY_FOR_REVIEW",
          422,
          "O conteúdo do Listening contém textos ou lacunas inválidos.",
        );
      }

      const allPassagesReady = validatedListening.data.passages.length > 0
        && validatedListening.data.passages.every(
          (passage) => passage.text.trim().length > 0
            && passage.blanks.length > 0
            && passage.audio.status === "READY"
            && Boolean(passage.audio.storageKey),
        );

      if (!allPassagesReady) {
        throw new AppError(
          "LISTENING_NOT_READY_FOR_REVIEW",
          422,
          "Cada texto precisa ter conteúdo, ao menos uma lacuna e um áudio gerado antes do envio para revisão.",
        );
      }
    }

    if (activity.type === ActivityType.QUIZ) {
      const validatedQuiz = quizContentSchema.safeParse(latestVersion.content);
      if (!validatedQuiz.success) {
        const validationDetails = validatedQuiz.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));

        console.warn("Quiz inválido ao enviar para revisão.", {
          activitySlug: activity.slug,
          versionId: latestVersion.id,
          validationDetails,
        });

        const detailMessage = validationDetails
          .map((issue) => `${issue.path || "content"}: ${issue.message}`)
          .join("; ");

        throw new AppError(
          "QUIZ_NOT_READY_FOR_REVIEW",
          422,
          detailMessage
            ? `O Quiz não atende aos requisitos para aprovação: ${detailMessage}`
            : "O Quiz precisa ter pelo menos uma questão válida, com enunciado, de 3 a 6 alternativas e exatamente uma resposta correta.",
        );
      }
    }

    if (activity.type === ActivityType.WORD_MATCHING || activity.type === ActivityType.MULTIPLE_CHOICE) {
      const validated = wordMatchingContentSchema.safeParse(latestVersion.content);
      if (!validated.success) {
        throw new AppError(
          activity.type === ActivityType.MULTIPLE_CHOICE ? "MULTIPLE_CHOICE_NOT_READY_FOR_REVIEW" : "WORD_MATCHING_NOT_READY_FOR_REVIEW",
          422,
          activity.type === ActivityType.MULTIPLE_CHOICE ? "A atividade precisa ter pelo menos 3 opções e correspondências válidas antes do envio para revisão." : "A atividade precisa ter pelo menos 3 associações válidas antes do envio para revisão.",
        );
      }
    }

    if (activity.type === ActivityType.SENTENCE_COMPLETION) {
      const validated = sentenceCompletionContentSchema.safeParse(latestVersion.content);
      if (!validated.success) {
        throw new AppError(
          "SENTENCE_COMPLETION_NOT_READY_FOR_REVIEW",
          422,
          "A atividade precisa ter frases, lacunas e palavras válidas antes do envio para revisão.",
        );
      }
    }

    latestVersion.status = ActivityVersionStatus.PENDING_REVIEW;
    latestVersion.submittedAt = new Date();
    latestVersion.reviewFeedback = null;
    latestVersion.reviewedAt = null;

    const savedVersion = await this.activityVersionRepository.save(
      this.manager,
      latestVersion,
    );

    return {
      activity,
      version: savedVersion,
    };
  }
}