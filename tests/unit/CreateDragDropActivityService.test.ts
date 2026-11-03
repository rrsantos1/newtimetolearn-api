import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { CreateDragDropActivityService } from "../../src/modules/activities/services/CreateDragDropActivityService";
import type { IActivityRepository } from "../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import { ActivityDifficulty } from "../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../src/modules/activities/types/ActivityVisibility";

const wordMatchingContent = {
  pairs: [
    { id: "pair-1", source: { type: "text", value: "Brasil" }, target: { type: "text", value: "Brasília" } },
    { id: "pair-2", source: { type: "text", value: "França" }, target: { type: "text", value: "Paris" } },
    { id: "pair-3", source: { type: "text", value: "Japão" }, target: { type: "text", value: "Tóquio" } },
  ],
};

const sentenceCompletionContent = {
  words: [
    { id: "word-1", text: "Sol" },
    { id: "word-2", text: "Lua" },
  ],
  sentences: [
    { id: "sentence-1", text: "O {{blank-1}} é uma estrela.", blanks: [{ id: "blank-1", expectedWordId: "word-1" }] },
    { id: "sentence-2", text: "A {{blank-2}} aparece à noite.", blanks: [{ id: "blank-2", expectedWordId: "word-2" }] },
  ],
};

describe("CreateDragDropActivityService", () => {
  let activityRepository: IActivityRepository;
  let activityVersionRepository: IActivityVersionRepository;
  let findBySlug: ReturnType<typeof vi.fn>;
  let saveActivity: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findBySlug = vi.fn().mockResolvedValue(null);
    saveActivity = vi.fn().mockImplementation(async (_manager, activity) => ({
      ...activity,
      id: "activity-123",
    }));
    saveVersion = vi.fn().mockImplementation(async (_manager, version) => ({
      ...version,
      id: "version-123",
    }));
    updatePublishedVersion = vi.fn().mockResolvedValue(undefined);

    activityRepository = {
      findBySlug,
      save: saveActivity,
      updatePublishedVersion,
    } as unknown as IActivityRepository;
    activityVersionRepository = {
      save: saveVersion,
    } as unknown as IActivityVersionRepository;
  });

  const createService = (type: ActivityType.WORD_MATCHING | ActivityType.SENTENCE_COMPLETION) =>
    new CreateDragDropActivityService(
      {} as EntityManager,
      activityRepository,
      activityVersionRepository,
      type,
    );

  const baseInput = {
    teacherId: "teacher-123",
    isAdmin: false,
    name: "  Atividade de associação  ",
    description: "  Descrição da atividade  ",
    difficulty: ActivityDifficulty.MEDIUM,
  };

  it.each([
    [ActivityType.WORD_MATCHING, wordMatchingContent],
    [ActivityType.SENTENCE_COMPLETION, sentenceCompletionContent],
  ] as const)("creates %s as a teacher draft", async (type, content) => {
    const result = await createService(type).execute({ ...baseInput, content });

    expect(result.activity).toMatchObject({
      id: "activity-123",
      teacherId: baseInput.teacherId,
      type,
      status: ActivityStatus.DRAFT,
      visibility: ActivityVisibility.AUTHENTICATED,
      executionCount: 0,
      currentPublishedVersionId: null,
    });
    expect(result.version).toMatchObject({
      id: "version-123",
      activityId: "activity-123",
      versionNumber: 1,
      name: "Atividade de associação",
      description: "Descrição da atividade",
      difficulty: ActivityDifficulty.MEDIUM,
      status: ActivityVersionStatus.DRAFT,
      revision: 1,
      content,
    });
    expect(result.version.timeLimitSeconds).toBe(900);
    expect(updatePublishedVersion).not.toHaveBeenCalled();
  });

  it.each([
    [ActivityType.WORD_MATCHING, wordMatchingContent],
    [ActivityType.SENTENCE_COMPLETION, sentenceCompletionContent],
  ] as const)("publishes %s immediately when created by an administrator", async (type, content) => {
    const result = await createService(type).execute({ ...baseInput, isAdmin: true, content });

    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe("version-123");
    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(saveActivity).toHaveBeenCalledTimes(2);
  });

  it("uses the custom time limit when provided", async () => {
    const result = await createService(ActivityType.WORD_MATCHING).execute({
      ...baseInput,
      content: wordMatchingContent,
      timeLimitSeconds: 600,
    });

    expect(result.version.timeLimitSeconds).toBe(600);
  });

  it("stores an empty description as null", async () => {
    const result = await createService(ActivityType.WORD_MATCHING).execute({
      ...baseInput,
      description: "   ",
      content: wordMatchingContent,
    });

    expect(result.version.description).toBeNull();
  });

  it.each([
    [ActivityType.WORD_MATCHING, { pairs: [] }],
    [ActivityType.SENTENCE_COMPLETION, { words: [], sentences: [] }],
  ] as const)("rejects invalid %s content before persisting", async (type, content) => {
    await expect(createService(type).execute({ ...baseInput, content })).rejects.toThrow();
    expect(saveActivity).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("generates a new slug when the first slug is already taken", async () => {
    findBySlug
      .mockResolvedValueOnce({ id: "existing-activity" })
      .mockResolvedValueOnce(null);

    const result = await createService(ActivityType.WORD_MATCHING).execute({
      ...baseInput,
      content: wordMatchingContent,
    });

    expect(findBySlug).toHaveBeenCalledTimes(2);
    expect(result.activity.slug).toBeTruthy();
  });
});
