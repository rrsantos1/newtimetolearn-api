import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserRepository } from "../../src/modules/users/repositories/interfaces/IUserRepository";
import type { IActivityRepository } from "../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../../src/modules/activities/repositories/interfaces/IActivityAttemptRepository";
import { SubmitDragDropActivityAttemptService } from "../../src/modules/activities/services/SubmitDragDropActivityAttemptService";
import { ActivityStatus } from "../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../src/modules/activities/types/ActivityVersionStatus";
import { createDragDropExecutionToken } from "../../src/modules/activities/utils/createDragDropExecutionToken";

const pairs = [
  { id: "pair-1", source: { type: "text" as const, value: "Brasil" }, target: { type: "text" as const, value: "Brasília" } },
  { id: "pair-2", source: { type: "text" as const, value: "França" }, target: { type: "text" as const, value: "Paris" } },
  { id: "pair-3", source: { type: "text" as const, value: "Japão" }, target: { type: "text" as const, value: "Tóquio" } },
];

describe("SubmitDragDropActivityAttemptService", () => {
  let attemptRepository: IActivityAttemptRepository;
  let activityRepository: IActivityRepository;
  let userRepository: IUserRepository;
  let findByAttemptToken: ReturnType<typeof vi.fn>;
  let createAttempt: ReturnType<typeof vi.fn>;
  let getRanking: ReturnType<typeof vi.fn>;
  let service: SubmitDragDropActivityAttemptService;

  const activity = {
    id: "activity-123",
    type: ActivityType.WORD_MATCHING,
    status: ActivityStatus.PUBLISHED,
    currentPublishedVersionId: "version-123",
    versions: [{
      id: "version-123",
      status: ActivityVersionStatus.PUBLISHED,
      timeLimitSeconds: 900,
      content: { pairs },
    }],
  };

  beforeEach(() => {
    findByAttemptToken = vi.fn().mockResolvedValue(null);
    createAttempt = vi.fn().mockImplementation(async (data) => ({
      id: "attempt-123",
      studentName: "Estudante",
      score: data.score,
      elapsedSeconds: data.elapsedSeconds,
      answers: data.answers,
      ...data,
    }));
    getRanking = vi.fn().mockResolvedValue([]);

    attemptRepository = {
      findByAttemptToken,
      create: createAttempt,
      getRanking,
    } as unknown as IActivityAttemptRepository;
    activityRepository = {
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
    } as unknown as IActivityRepository;
    userRepository = {
      findById: vi.fn().mockResolvedValue({ id: "student-123", name: "Estudante" }),
    } as unknown as IUserRepository;

    service = new SubmitDragDropActivityAttemptService(
      attemptRepository,
      activityRepository,
      userRepository,
      ActivityType.WORD_MATCHING,
    );
  });

  it("scores a fully correct attempt and returns corrections", async () => {
    const answers = pairs.map((pair) => ({
      itemId: createDragDropExecutionToken(pair.id, "source"),
      selectedId: createDragDropExecutionToken(pair.id, "target"),
    }));

    const result = await service.execute({
      slug: "associacao",
      userId: "student-123",
      answers,
      elapsedSeconds: 0,
      attemptToken: "attempt-token-1",
    });

    expect(result).toMatchObject({
      correctCount: 3,
      totalItems: 3,
      isInRanking: false,
    });
    expect(result.attempt.score).toBe(100);
    expect(result.attempt.accuracyPoints).toBe(80);
    expect(result.attempt.speedPoints).toBe(20);
    expect(result.corrections.every((correction) => correction.isCorrect)).toBe(true);
    expect(createAttempt).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown items and repeated selections", async () => {
    const firstTarget = createDragDropExecutionToken("pair-1", "target");
    const answers = [
      { itemId: createDragDropExecutionToken("pair-1", "source"), selectedId: firstTarget },
      { itemId: createDragDropExecutionToken("pair-2", "source"), selectedId: firstTarget },
      { itemId: "unknown-item", selectedId: "unknown-selection" },
    ];

    const result = await service.execute({
      slug: "associacao",
      userId: "student-123",
      answers,
      elapsedSeconds: 30,
      attemptToken: "attempt-token-2",
    });

    expect(result.correctCount).toBe(1);
    expect(result.totalItems).toBe(3);
    expect(result.corrections).toHaveLength(3);
    expect(createAttempt).toHaveBeenCalledWith(expect.objectContaining({
      wordsFound: [createDragDropExecutionToken("pair-1", "source")],
      totalWords: 3,
    }));
  });

  it("returns the previous attempt when the attempt token was already used", async () => {
    const previousAttempt = {
      id: "attempt-existing",
      answers: pairs.map((pair) => ({
        itemId: createDragDropExecutionToken(pair.id, "source"),
        selectedId: createDragDropExecutionToken(pair.id, "target"),
      })),
      studentName: "Estudante",
      score: 100,
      elapsedSeconds: 10,
    };
    findByAttemptToken.mockResolvedValue(previousAttempt);

    const result = await service.execute({
      slug: "associacao",
      userId: "student-123",
      answers: [],
      elapsedSeconds: 10,
      attemptToken: "attempt-token-1",
    });

    expect(result.attempt).toBe(previousAttempt);
    expect(result.correctCount).toBe(3);
    expect(result.totalItems).toBe(3);
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it("rejects an unpublished or missing activity", async () => {
    const unavailableRepository = {
      findBySlugWithVersions: vi.fn().mockResolvedValue(null),
    } as unknown as IActivityRepository;
    const unavailableService = new SubmitDragDropActivityAttemptService(
      attemptRepository,
      unavailableRepository,
      userRepository,
      ActivityType.WORD_MATCHING,
    );

    await expect(unavailableService.execute({
      slug: "inexistente",
      userId: "student-123",
      answers: [],
      elapsedSeconds: 0,
      attemptToken: "attempt-token-3",
    })).rejects.toThrow();

    expect(createAttempt).not.toHaveBeenCalled();
  });
  it("scores sentence-completion blanks using their expected word identifiers", async () => {
    const sentenceActivity = {
      ...activity,
      type: ActivityType.SENTENCE_COMPLETION,
      versions: [{
        ...activity.versions[0],
        content: {
          words: [
            { id: "word-sun", text: "Sol" },
            { id: "word-moon", text: "Lua" },
          ],
          sentences: [
            { id: "sentence-1", text: "O {{blank-1}} brilha.", blanks: [{ id: "blank-1", expectedWordId: "word-sun" }] },
            { id: "sentence-2", text: "A {{blank-2}} aparece.", blanks: [{ id: "blank-2", expectedWordId: "word-moon" }] },
          ],
        },
      }],
    };
    const sentenceService = new SubmitDragDropActivityAttemptService(
      attemptRepository,
      {
        findBySlugWithVersions: vi.fn().mockResolvedValue(sentenceActivity),
      } as unknown as IActivityRepository,
      userRepository,
      ActivityType.SENTENCE_COMPLETION,
    );

    const result = await sentenceService.execute({
      slug: "complete-as-frases",
      userId: "student-123",
      answers: [
        { itemId: "blank-1", selectedId: "word-sun" },
        { itemId: "blank-2", selectedId: "word-moon" },
      ],
      elapsedSeconds: 0,
      attemptToken: "sentence-attempt-token",
    });

    expect(result.correctCount).toBe(2);
    expect(result.totalItems).toBe(2);
    expect(result.corrections.every((correction) => correction.isCorrect)).toBe(true);
    expect(createAttempt).toHaveBeenCalledWith(expect.objectContaining({
      wordsFound: ["blank-1", "blank-2"],
      totalWords: 2,
    }));
  });

});
