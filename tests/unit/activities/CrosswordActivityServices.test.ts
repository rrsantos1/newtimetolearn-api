import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { CrosswordGenerationError } from "../../../src/modules/activities/errors/CrosswordGenerationError";
import { CreateCrosswordActivityService } from "../../../src/modules/activities/services/CreateCrosswordActivityService";
import { EditCrosswordActivityService } from "../../../src/modules/activities/services/EditCrosswordActivityService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";
import * as crosswordGenerator from "../../../src/modules/activities/utils/crossword/generateCrosswordPuzzle";
import type { CrosswordRenderResult } from "../../../src/modules/activities/utils/crossword/render/CrosswordRenderer";

const teacherId = "teacher-123";
const slug = "cruzadinha-de-ciencias";
const words = [
  { word: "SOL", clue: "Estrela central do Sistema Solar" },
  { word: "LUA", clue: "Satélite natural da Terra" },
  { word: "TERRA", clue: "Planeta em que vivemos" },
];
const preview: CrosswordRenderResult = {
  grid: [["S", "O", "L"]],
  clues: [
    { number: 1, clue: words[0].clue, direction: "across", row: 0, col: 0, word: "SOL" },
  ],
};

describe("CrosswordActivityServices", () => {
  let activity: Activity;
  let publishedVersion: ActivityVersion;
  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;
  let findBySlug: ReturnType<typeof vi.fn>;
  let findBySlugWithVersions: ReturnType<typeof vi.fn>;
  let saveActivity: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;

  const resetFixture = (): void => {
    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = teacherId;
    activity.slug = slug;
    activity.type = ActivityType.CROSSWORD;
    activity.status = ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    publishedVersion = new ActivityVersion();
    publishedVersion.id = "version-1";
    publishedVersion.activityId = activity.id;
    publishedVersion.versionNumber = 1;
    publishedVersion.name = "Cruzadinha";
    publishedVersion.description = null;
    publishedVersion.difficulty = ActivityDifficulty.EASY;
    publishedVersion.timeLimitSeconds = 900;
    publishedVersion.content = { words };
    publishedVersion.generatedData = preview;
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;
    publishedVersion.revision = 1;
    publishedVersion.submittedAt = null;
    publishedVersion.publishedAt = new Date();
    publishedVersion.reviewFeedback = null;
    publishedVersion.reviewedAt = null;
    activity.versions = [publishedVersion];

    findBySlug = vi.fn().mockResolvedValue(null);
    findBySlugWithVersions = vi.fn().mockResolvedValue(activity);
    saveActivity = vi.fn().mockImplementation(async (_manager: EntityManager, value: Activity) => {
      value.id = "activity-123";
      return value;
    });
    saveVersion = vi.fn().mockImplementation(async (_manager: EntityManager, value: ActivityVersion) => {
      if (!value.id) value.id = "version-new";
      return value;
    });
    updatePublishedVersion = vi.fn().mockResolvedValue(undefined);

    activityRepository = {
      findBySlug,
      findBySlugWithVersions,
      save: saveActivity,
      updatePublishedVersion,
    } as unknown as IActivityRepository;
    versionRepository = { save: saveVersion } as unknown as IActivityVersionRepository;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetFixture();
    vi.spyOn(crosswordGenerator, "generateCrosswordPuzzle").mockReturnValue(preview);
  });

  const createInput = {
    teacherId,
    isAdmin: false,
    name: "  Cruzadinha de Ciências  ",
    description: "  Conceitos básicos  ",
    difficulty: ActivityDifficulty.MEDIUM,
    words,
  };

  it("creates a teacher crossword as a draft and stores generated preview data", async () => {
    const result = await new CreateCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute(createInput);

    expect(result.activity).toMatchObject({
      teacherId,
      type: ActivityType.CROSSWORD,
      status: ActivityStatus.DRAFT,
      visibility: ActivityVisibility.AUTHENTICATED,
    });
    expect(result.version).toMatchObject({
      activityId: activity.id,
      versionNumber: 1,
      name: "Cruzadinha de Ciências",
      description: "Conceitos básicos",
      difficulty: ActivityDifficulty.MEDIUM,
      timeLimitSeconds: 900,
      status: ActivityVersionStatus.DRAFT,
      revision: 1,
      content: { words },
      generatedData: { grid: preview.grid, clues: preview.clues },
    });
    expect(crosswordGenerator.generateCrosswordPuzzle).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ word: "SOL" })]),
      25,
      25,
    );
  });

  it("publishes a crossword created by an administrator", async () => {
    const result = await new CreateCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute({ ...createInput, isAdmin: true });

    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe(result.version.id);
    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(saveActivity).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid or duplicate answers before persisting the crossword", async () => {
    const service = new CreateCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    );

    await expect(service.execute({ ...createInput, words: [{ word: "SOL", clue: "Uma estrela" }] }))
      .rejects.toThrow();
    await expect(service.execute({
      ...createInput,
      words: [
        { word: "LEÃO", clue: "Felino" },
        { word: "LEAO", clue: "Mesmo felino" },
        { word: "TERRA", clue: "Planeta" },
      ],
    })).rejects.toThrow();

    expect(saveActivity).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("maps crossword generation failures to a domain error", async () => {
    vi.mocked(crosswordGenerator.generateCrosswordPuzzle).mockImplementationOnce(() => {
      throw new CrosswordGenerationError("Falha simulada", "INCOMPLETE_GENERATION");
    });

    await expect(new CreateCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute(createInput)).rejects.toMatchObject({
      code: "CROSSWORD_GENERATION_FAILED",
      statusCode: 422,
    });
    expect(saveActivity).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("edits an existing crossword draft and increments its revision", async () => {
    const draft = new ActivityVersion();
    Object.assign(draft, publishedVersion, {
      id: "version-draft",
      status: ActivityVersionStatus.DRAFT,
      revision: 2,
    });
    activity.versions = [publishedVersion, draft];

    const result = await new EditCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute({
      slug, teacherId, isAdmin: false, name: "  Cruzadinha revisada  ",
      description: "  Nova descrição  ", difficulty: ActivityDifficulty.HARD, words,
    });

    expect(result.version).toBe(draft);
    expect(result.version).toMatchObject({
      name: "Cruzadinha revisada",
      description: "Nova descrição",
      revision: 3,
      status: ActivityVersionStatus.DRAFT,
      difficulty: ActivityDifficulty.HARD,
      content: { words },
      generatedData: { grid: preview.grid, clues: preview.clues },
    });
    expect(result.preview).toEqual(preview);
  });

  it("creates a new crossword version and publishes it for an administrator", async () => {
    const result = await new EditCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute({
      slug, teacherId, isAdmin: true, name: "Cruzadinha atualizada",
      difficulty: ActivityDifficulty.MEDIUM, timeLimitSeconds: 600, words,
    });

    expect(result.version).toMatchObject({
      versionNumber: 2,
      revision: 1,
      status: ActivityVersionStatus.PUBLISHED,
      timeLimitSeconds: 600,
    });
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(updatePublishedVersion).toHaveBeenCalledOnce();
    expect(activity.currentPublishedVersionId).toBe(result.version.id);
  });

  it("blocks crossword edits for pending review, another owner and invalid content", async () => {
    const service = new EditCrosswordActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    );
    const input = {
      slug, teacherId, isAdmin: false, name: "Cruzadinha",
      difficulty: ActivityDifficulty.EASY, words,
    };

    publishedVersion.status = ActivityVersionStatus.PENDING_REVIEW;
    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_PENDING_REVIEW",
      statusCode: 409,
    });
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;
    await expect(service.execute({ ...input, teacherId: "other-teacher" })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    await expect(service.execute({ ...input, words: [{ word: "SOL", clue: "Estrela" }] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
    expect(saveVersion).not.toHaveBeenCalled();
  });
});
