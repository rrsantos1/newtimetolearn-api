import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../../src/modules/users/entities/User";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { ListeningAttempt } from "../../../src/modules/activities/entities/ListeningAttempt";
import { SubmitListeningAttemptService } from "../../../src/modules/activities/services/SubmitListeningAttemptService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { CreateListeningAttemptInput, IListeningAttemptRepository } from "../../../src/modules/activities/repositories/interfaces/IListeningAttemptRepository";
import type { IUserRepository } from "../../../src/modules/users/repositories/interfaces/IUserRepository";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";

describe("SubmitListeningAttemptService", () => {
  let service: SubmitListeningAttemptService;
  let activityRepository: IActivityRepository;
  let attemptRepository: IListeningAttemptRepository;
  let userRepository: IUserRepository;
  let activity: Activity;
  let version: ActivityVersion;
  let user: User;

  const input = {
    slug: "listening-animais",
    userId: "student-123",
    elapsedSeconds: 42,
    answers: [
      { passageId: "passage-1", blankId: "blank-1", answer: " GATO " },
      { passageId: "passage-1", blankId: "blank-2", answer: "caminha" },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    user = new User();
    user.id = input.userId;
    user.name = "Estudante Teste";

    activity = new Activity();
    activity.id = "activity-123";
    activity.slug = input.slug;
    activity.type = ActivityType.LISTENING;
    activity.status = ActivityStatus.PUBLISHED;
    activity.currentPublishedVersionId = "version-123";
    activity.deletedAt = null;

    version = new ActivityVersion();
    version.id = "version-123";
    version.activityId = activity.id;
    version.status = ActivityVersionStatus.PUBLISHED;
    version.content = {
      language: "pt-BR",
      instructions: "Ouça e complete.",
      passages: [
        {
          id: "passage-1",
          title: "Animais",
          text: "gato corre",
          blanks: [
            {
              id: "blank-1",
              startOffset: 0,
              endOffset: 4,
              expectedAnswer: "gato",
              alternatives: ["felino"],
            },
            {
              id: "blank-2",
              startOffset: 5,
              endOffset: 10,
              expectedAnswer: "corre",
              alternatives: ["caminha"],
            },
          ],
          audio: {
            storageKey: "listening/audio.mp3",
            publicUrl: null,
            disclosure: null,
            status: "READY",
          },
        },
      ],
    };
    activity.versions = [version];

    activityRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      updatePublishedVersion: vi.fn(),
    };

    attemptRepository = {
      create: vi.fn().mockImplementation(async (attemptInput: CreateListeningAttemptInput) => {
        const attempt = new ListeningAttempt();
        attempt.id = "attempt-123";
        attempt.activityId = attemptInput.activityId;
        attempt.activityVersionId = attemptInput.activityVersionId;
        attempt.userId = attemptInput.userId;
        attempt.studentName = attemptInput.studentName;
        attempt.answers = attemptInput.answers;
        attempt.totalBlanks = attemptInput.totalBlanks;
        attempt.correctBlanks = attemptInput.correctBlanks;
        attempt.elapsedSeconds = attemptInput.elapsedSeconds;
        attempt.score = attemptInput.score;
        attempt.createdAt = new Date("2026-11-02T10:00:00.000Z");
        return attempt;
      }),
      getRanking: vi.fn().mockResolvedValue([]),
      listByActivity: vi.fn(),
    };

    userRepository = {
      findById: vi.fn().mockResolvedValue(user),
      findByEmail: vi.fn(),
    };

    service = new SubmitListeningAttemptService(
      attemptRepository,
      activityRepository,
      userRepository,
    );
  });

  it("corrige respostas sem diferenciar maiúsculas e espaços e aceita alternativas", async () => {
    const result = await service.execute(input);

    expect(result.totalBlanks).toBe(2);
    expect(result.correctBlanks).toBe(2);
    expect(result.attempt.score).toBe(100);
    expect(result.attempt.elapsedSeconds).toBe(42);
    expect(result.review.every((answer) => answer.isCorrect)).toBe(true);
    expect(attemptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: activity.id,
        activityVersionId: version.id,
        userId: user.id,
        studentName: user.name,
        totalBlanks: 2,
        correctBlanks: 2,
        score: 100,
        elapsedSeconds: 42,
      }),
    );
  });

  it("considera as lacunas não respondidas como incorretas", async () => {
    const result = await service.execute({
      ...input,
      answers: [{ passageId: "passage-1", blankId: "blank-1", answer: "gato" }],
    });

    expect(result.totalBlanks).toBe(2);
    expect(result.correctBlanks).toBe(1);
    expect(result.attempt.score).toBe(50);
    expect(result.review[1]).toMatchObject({ answer: "", isCorrect: false });
  });

  it("rejeita tentativas quando a atividade não está publicada", async () => {
    activity.status = ActivityStatus.DRAFT;

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    expect(attemptRepository.create).not.toHaveBeenCalled();
  });

  it("rejeita a execução quando o áudio ainda não está pronto", async () => {
    const content = version.content as {
      passages: Array<{ audio: { status: string } }>;
    };
    content.passages[0]!.audio.status = "PENDING";

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "LISTENING_NOT_READY",
      statusCode: 422,
    });
    expect(attemptRepository.create).not.toHaveBeenCalled();
  });

  it("rejeita lacunas que não pertencem à atividade", async () => {
    await expect(
      service.execute({
        ...input,
        answers: [{ passageId: "passage-1", blankId: "missing-blank", answer: "gato" }],
      }),
    ).rejects.toMatchObject({
      code: "INVALID_LISTENING_ANSWER",
      statusCode: 400,
    });
    expect(attemptRepository.create).not.toHaveBeenCalled();
  });

  it("rejeita respostas duplicadas para a mesma lacuna", async () => {
    await expect(
      service.execute({
        ...input,
        answers: [
          { passageId: "passage-1", blankId: "blank-1", answer: "gato" },
          { passageId: "passage-1", blankId: "blank-1", answer: "felino" },
        ],
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_LISTENING_ANSWER",
      statusCode: 400,
    });
    expect(attemptRepository.create).not.toHaveBeenCalled();
  });

  it("registra se a tentativa entrou no ranking", async () => {
    vi.mocked(attemptRepository.getRanking).mockImplementation(async () => {
      const rankedAttempt = new ListeningAttempt();
      rankedAttempt.id = "attempt-123";
      return [rankedAttempt];
    });

    const result = await service.execute(input);

    expect(result.isInRanking).toBe(true);
    expect(result.ranking).toHaveLength(1);
  });
});
