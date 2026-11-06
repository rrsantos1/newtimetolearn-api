import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { EditDragDropActivityService } from "../../../src/modules/activities/services/EditDragDropActivityService";
import { EditQuizActivityService } from "../../../src/modules/activities/services/EditQuizActivityService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

const teacherId = "teacher-123";
const slug = "atividade-exemplo";

const quizContent = {
  questions: [
    {
      id: "question-1",
      statement: "Qual estrela está no centro do Sistema Solar?",
      images: [],
      options: [
        { id: "option-1", text: "Sol", images: [] },
        { id: "option-2", text: "Sirius", images: [] },
        { id: "option-3", text: "Vega", images: [] },
      ],
      correctOptionId: "option-1",
      explanation: "O Sol está no centro do Sistema Solar.",
    },
  ],
};

const matchingContent = {
  pairs: [
    { id: "pair-1", source: { type: "text" as const, value: "Brasil" }, target: { type: "text" as const, value: "Brasília" } },
    { id: "pair-2", source: { type: "text" as const, value: "França" }, target: { type: "text" as const, value: "Paris" } },
    { id: "pair-3", source: { type: "text" as const, value: "Japão" }, target: { type: "text" as const, value: "Tóquio" } },
  ],
};

const sentenceContent = {
  words: [
    { id: "word-1", text: "Sol" },
    { id: "word-2", text: "Lua" },
  ],
  sentences: [
    { id: "sentence-1", text: "O {{blank-1}} é uma estrela.", blanks: [{ id: "blank-1", expectedWordId: "word-1" }] },
    { id: "sentence-2", text: "A {{blank-2}} aparece à noite.", blanks: [{ id: "blank-2", expectedWordId: "word-2" }] },
  ],
};

describe("EditActivityServices", () => {
  let activity: Activity;
  let publishedVersion: ActivityVersion;
  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;
  let findBySlugWithVersions: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;

  const resetFixture = (type: ActivityType): void => {
    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = teacherId;
    activity.slug = slug;
    activity.type = type;
    activity.status = ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    publishedVersion = new ActivityVersion();
    publishedVersion.id = "version-1";
    publishedVersion.activityId = activity.id;
    publishedVersion.versionNumber = 1;
    publishedVersion.name = "Versão publicada";
    publishedVersion.description = null;
    publishedVersion.difficulty = ActivityDifficulty.EASY;
    publishedVersion.timeLimitSeconds = 900;
    publishedVersion.content = {};
    publishedVersion.generatedData = null;
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;
    publishedVersion.revision = 1;
    publishedVersion.submittedAt = null;
    publishedVersion.publishedAt = new Date();
    publishedVersion.reviewFeedback = null;
    publishedVersion.reviewedAt = null;
    activity.versions = [publishedVersion];

    findBySlugWithVersions = vi.fn().mockResolvedValue(activity);
    saveVersion = vi.fn().mockImplementation(async (_manager: EntityManager, version: ActivityVersion) => {
      if (!version.id) version.id = "version-new";
      return version;
    });
    updatePublishedVersion = vi.fn().mockResolvedValue(undefined);

    activityRepository = {
      findBySlugWithVersions,
      updatePublishedVersion,
    } as unknown as IActivityRepository;
    versionRepository = { save: saveVersion } as unknown as IActivityVersionRepository;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("edits the existing Quiz draft and increments its revision", async () => {
    resetFixture(ActivityType.QUIZ);
    const draft = new ActivityVersion();
    Object.assign(draft, publishedVersion, {
      id: "version-draft",
      status: ActivityVersionStatus.DRAFT,
      revision: 2,
    });
    activity.versions = [publishedVersion, draft];

    const service = new EditQuizActivityService({} as EntityManager, activityRepository, versionRepository);
    const result = await service.execute({
      slug,
      teacherId,
      isAdmin: false,
      name: "  Quiz revisado  ",
      description: "  Nova descrição  ",
      difficulty: ActivityDifficulty.HARD,
      content: quizContent,
    });

    expect(result.version).toBe(draft);
    expect(result.version).toMatchObject({
      name: "Quiz revisado",
      description: "Nova descrição",
      difficulty: ActivityDifficulty.HARD,
      revision: 3,
      status: ActivityVersionStatus.DRAFT,
      content: quizContent,
    });
    expect(result.version.timeLimitSeconds).toBe(900);
    expect(updatePublishedVersion).not.toHaveBeenCalled();
  });

  it("creates a new Quiz version after a published version and publishes it for an administrator", async () => {
    resetFixture(ActivityType.QUIZ);
    const service = new EditQuizActivityService({} as EntityManager, activityRepository, versionRepository);

    const result = await service.execute({
      slug,
      teacherId,
      isAdmin: true,
      name: "Quiz atualizado",
      difficulty: ActivityDifficulty.MEDIUM,
      timeLimitSeconds: 600,
      content: quizContent,
    });

    expect(result.version).not.toBe(publishedVersion);
    expect(result.version).toMatchObject({
      activityId: activity.id,
      versionNumber: 2,
      revision: 1,
      status: ActivityVersionStatus.PUBLISHED,
      timeLimitSeconds: 600,
    });
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(updatePublishedVersion).toHaveBeenCalledWith({}, activity.id, result.version.id);
    expect(activity.currentPublishedVersionId).toBe(result.version.id);
  });

  it("rejects Quiz edits for pending review, invalid content and a different owner", async () => {
    resetFixture(ActivityType.QUIZ);
    publishedVersion.status = ActivityVersionStatus.PENDING_REVIEW;
    const service = new EditQuizActivityService({} as EntityManager, activityRepository, versionRepository);
    const validInput = {
      slug, teacherId, isAdmin: false, name: "Quiz", difficulty: ActivityDifficulty.EASY, content: quizContent,
    };

    await expect(service.execute(validInput)).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_PENDING_REVIEW",
      statusCode: 409,
    });
    await expect(service.execute({ ...validInput, teacherId: "other-teacher" })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;
    await expect(service.execute({ ...validInput, content: { questions: [{ id: "duplicate", options: [] }, { id: "duplicate", options: [] }] } })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("edits Word Matching content and stores no generated data", async () => {
    resetFixture(ActivityType.WORD_MATCHING);
    const service = new EditDragDropActivityService(
      {} as EntityManager, activityRepository, versionRepository, ActivityType.WORD_MATCHING,
    );

    const result = await service.execute({
      slug,
      teacherId,
      isAdmin: false,
      name: "Associação atualizada",
      difficulty: ActivityDifficulty.MEDIUM,
      content: matchingContent,
    });

    expect(result.version).toMatchObject({
      versionNumber: 2,
      revision: 1,
      name: "Associação atualizada",
      status: ActivityVersionStatus.DRAFT,
      content: matchingContent,
      generatedData: null,
    });
    expect(result.version.timeLimitSeconds).toBe(900);
    expect(updatePublishedVersion).not.toHaveBeenCalled();
  });

  it("edits Sentence Completion and publishes the version for an administrator", async () => {
    resetFixture(ActivityType.SENTENCE_COMPLETION);
    const service = new EditDragDropActivityService(
      {} as EntityManager, activityRepository, versionRepository, ActivityType.SENTENCE_COMPLETION,
    );

    const result = await service.execute({
      slug,
      teacherId,
      isAdmin: true,
      name: "Complete as frases",
      difficulty: ActivityDifficulty.HARD,
      timeLimitSeconds: 720,
      content: sentenceContent,
    });

    expect(result.version).toMatchObject({
      status: ActivityVersionStatus.PUBLISHED,
      timeLimitSeconds: 720,
      content: sentenceContent,
    });
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(updatePublishedVersion).toHaveBeenCalledOnce();
  });

  it("rejects drag-and-drop edits when the activity type, owner or content is invalid", async () => {
    resetFixture(ActivityType.WORD_MATCHING);
    const service = new EditDragDropActivityService(
      {} as EntityManager, activityRepository, versionRepository, ActivityType.WORD_MATCHING,
    );
    const validInput = {
      slug, teacherId, isAdmin: false, name: "Associação", difficulty: ActivityDifficulty.EASY, content: matchingContent,
    };

    await expect(service.execute({ ...validInput, teacherId: "other-teacher" })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    activity.type = ActivityType.QUIZ;
    await expect(service.execute(validInput)).rejects.toMatchObject({
      code: "ACTIVITY_TYPE_NOT_SUPPORTED",
      statusCode: 422,
    });
    activity.type = ActivityType.WORD_MATCHING;
    await expect(service.execute({ ...validInput, content: { pairs: [] } })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("prevents drag-and-drop edits for archived activities and versions awaiting review", async () => {
    resetFixture(ActivityType.WORD_MATCHING);
    const service = new EditDragDropActivityService(
      {} as EntityManager, activityRepository, versionRepository, ActivityType.WORD_MATCHING,
    );
    const input = {
      slug, teacherId, isAdmin: false, name: "Associação", difficulty: ActivityDifficulty.EASY, content: matchingContent,
    };

    activity.status = ActivityStatus.ARCHIVED;
    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_EDITABLE",
      statusCode: 409,
    });
    activity.status = ActivityStatus.DRAFT;
    publishedVersion.status = ActivityVersionStatus.PENDING_REVIEW;
    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_PENDING_REVIEW",
      statusCode: 409,
    });
    expect(saveVersion).not.toHaveBeenCalled();
  });
});
