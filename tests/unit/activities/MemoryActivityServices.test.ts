import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { CreateMemoryActivityService } from "../../../src/modules/activities/services/CreateMemoryActivityService";
import { EditMemoryActivityService } from "../../../src/modules/activities/services/EditMemoryActivityService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import type { CreateMemoryActivityInput } from "../../../src/modules/activities/types/memory/CreateMemoryActivityInput";
import type { CreateMemoryActivityBody } from "../../../src/modules/activities/schemas/createMemoryActivitySchema";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

const content = {
  pairs: [
    { id: "pair-1", first: { type: "text" as const, value: "Sol" }, second: { type: "text" as const, value: "Estrela" } },
    { id: "pair-2", first: { type: "text" as const, value: "Lua" }, second: { type: "text" as const, value: "Satélite" } },
    { id: "pair-3", first: { type: "image" as const, storageKey: "media/gato.webp", altText: "Gato" }, second: { type: "text" as const, value: "Felino" } },
  ],
};

describe("MemoryActivityServices", () => {
  const teacherId = "teacher-123";
  const slug = "jogo-da-memoria";
  const manager = {} as EntityManager;

  let activity: Activity;
  let draft: ActivityVersion;
  let findBySlug: ReturnType<typeof vi.fn>;
  let findBySlugWithVersions: ReturnType<typeof vi.fn>;
  let saveActivity: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;
  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;

  const createInput: CreateMemoryActivityInput = {
    teacherId,
    isAdmin: false,
    name: "  Jogo da Memória  ",
    description: "  Associação de conceitos  ",
    difficulty: ActivityDifficulty.MEDIUM,
    content,
  };

  const editInput: CreateMemoryActivityBody & { slug: string; teacherId: string; isAdmin: boolean } = {
    slug,
    teacherId,
    isAdmin: false,
    name: "  Memória revisada  ",
    description: "  Nova descrição  ",
    difficulty: ActivityDifficulty.HARD,
    content,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = teacherId;
    activity.slug = slug;
    activity.type = ActivityType.MEMORY;
    activity.status = ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    draft = new ActivityVersion();
    draft.id = "version-123";
    draft.activityId = activity.id;
    draft.versionNumber = 1;
    draft.name = "Memória";
    draft.description = null;
    draft.difficulty = ActivityDifficulty.MEDIUM;
    draft.timeLimitSeconds = 900;
    draft.content = content;
    draft.status = ActivityVersionStatus.DRAFT;
    draft.revision = 1;
    draft.submittedAt = null;
    draft.publishedAt = null;
    draft.generatedData = null;
    draft.reviewFeedback = null;
    draft.reviewedAt = null;
    activity.versions = [draft];

    findBySlug = vi.fn().mockResolvedValue(null);
    findBySlugWithVersions = vi.fn().mockResolvedValue(activity);
    saveActivity = vi.fn().mockImplementation(async (_manager: EntityManager, value: Activity) => {
      value.id = "activity-123";
      return value;
    });
    saveVersion = vi.fn().mockImplementation(async (_manager: EntityManager, value: ActivityVersion) => {
      if (!value.id) value.id = "version-123";
      return value;
    });
    updatePublishedVersion = vi.fn().mockResolvedValue(undefined);

    activityRepository = {
      findById: vi.fn(),
      listFavoriteIds: vi.fn(),
      findBySlug,
      findBySlugWithVersions,
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: saveActivity,
      updatePublishedVersion,
    };
    versionRepository = {
      findById: vi.fn(),
      hasAudioStorageKeyReference: vi.fn(),
      findByIdAndActivityIdForUpdate: vi.fn(),
      findByActivityIdAndVersionNumber: vi.fn(),
      findByActivityId: vi.fn(),
      findByActivityIdAndStatus: vi.fn(),
      findLatestByActivityId: vi.fn(),
      save: saveVersion,
    };
  });

  it("cria a atividade como rascunho para o professor e aplica o tempo padrão", async () => {
    const result = await new CreateMemoryActivityService(manager, activityRepository, versionRepository).execute(createInput);

    expect(result.activity).toMatchObject({
      teacherId,
      type: ActivityType.MEMORY,
      status: ActivityStatus.DRAFT,
      visibility: ActivityVisibility.AUTHENTICATED,
      currentPublishedVersionId: null,
    });
    expect(result.version).toMatchObject({
      activityId: "activity-123",
      versionNumber: 1,
      name: "Jogo da Memória",
      description: "Associação de conceitos",
      status: ActivityVersionStatus.DRAFT,
      revision: 1,
      content,
      timeLimitSeconds: 900,
    });
    expect(updatePublishedVersion).not.toHaveBeenCalled();
  });

  it("publica imediatamente uma atividade criada por administrador", async () => {
    const result = await new CreateMemoryActivityService(manager, activityRepository, versionRepository)
      .execute({ ...createInput, isAdmin: true });

    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe(result.version.id);
    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(saveActivity).toHaveBeenCalledTimes(2);
  });

  it("rejeita conteúdo inválido antes de salvar a atividade", async () => {
    await expect(new CreateMemoryActivityService(manager, activityRepository, versionRepository)
      .execute({ ...createInput, content: { pairs: [] } as CreateMemoryActivityInput["content"] }))
      .rejects.toThrow();

    expect(saveActivity).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("edita o rascunho existente e incrementa a revisão", async () => {
    const result = await new EditMemoryActivityService(manager, activityRepository, versionRepository).execute(editInput);

    expect(result.version).toBe(draft);
    expect(result.version.revision).toBe(2);
    expect(result.version.name).toBe("Memória revisada");
    expect(result.version.description).toBe("Nova descrição");
    expect(result.version.difficulty).toBe(ActivityDifficulty.HARD);
    expect(result.version.status).toBe(ActivityVersionStatus.DRAFT);
    expect(result.version.content).toEqual(content);
    expect(saveVersion).toHaveBeenCalledOnce();
  });

  it("cria nova versão quando a anterior está publicada", async () => {
    draft.status = ActivityVersionStatus.PUBLISHED;
    draft.versionNumber = 3;

    const result = await new EditMemoryActivityService(manager, activityRepository, versionRepository).execute(editInput);

    expect(result.version).not.toBe(draft);
    expect(result.version.versionNumber).toBe(4);
    expect(result.version.revision).toBe(1);
    expect(result.version.status).toBe(ActivityVersionStatus.DRAFT);
  });

  it("impede edição enquanto existe uma versão aguardando revisão", async () => {
    draft.status = ActivityVersionStatus.PENDING_REVIEW;

    await expect(new EditMemoryActivityService(manager, activityRepository, versionRepository).execute(editInput))
      .rejects.toMatchObject({ code: "ACTIVITY_VERSION_PENDING_REVIEW", statusCode: 409 });

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("impede edição por outro professor e de atividades arquivadas", async () => {
    await expect(new EditMemoryActivityService(manager, activityRepository, versionRepository)
      .execute({ ...editInput, teacherId: "other-teacher" }))
      .rejects.toMatchObject({ code: "ACTIVITY_NOT_FOUND", statusCode: 404 });

    activity.status = ActivityStatus.ARCHIVED;
    await expect(new EditMemoryActivityService(manager, activityRepository, versionRepository).execute(editInput))
      .rejects.toMatchObject({ code: "ACTIVITY_NOT_EDITABLE", statusCode: 409 });

    expect(saveVersion).not.toHaveBeenCalled();
  });
});
