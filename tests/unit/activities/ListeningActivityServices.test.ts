import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { CreateListeningActivityService } from "../../../src/modules/activities/services/CreateListeningActivityService";
import { EditListeningActivityService } from "../../../src/modules/activities/services/EditListeningActivityService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import type { CreateListeningActivityInput } from "../../../src/modules/activities/types/listening/CreateListeningActivityInput";
import type { CreateListeningActivityBody } from "../../../src/modules/activities/schemas/createListeningActivitySchema";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

const passage = {
  id: "passage-1",
  title: "Animais",
  text: "O gato corre.",
  blanks: [{ id: "blank-1", startOffset: 2, endOffset: 6, expectedAnswer: "gato", alternatives: [] }],
  audio: {
    storageKey: "audio/listening/original.mp3",
    publicUrl: "https://cdn.example.test/audio/listening/original.mp3",
    disclosure: "Áudio gerado por IA.",
    status: "READY" as const,
    model: "gpt-4o-mini-tts",
    voice: "coral",
    textHash: "text-hash",
    durationSeconds: 4,
    sizeBytes: 120,
  },
};

const content = {
  language: "pt-BR",
  instructions: "Ouça e complete.",
  passages: [passage],
};

describe("ListeningActivityServices", () => {
  const teacherId = "teacher-123";
  const slug = "listening-animais";
  const manager = {} as EntityManager;

  let activity: Activity;
  let version: ActivityVersion;
  let findBySlug: ReturnType<typeof vi.fn>;
  let findBySlugWithVersions: ReturnType<typeof vi.fn>;
  let saveActivity: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;
  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;

  const createInput: CreateListeningActivityInput = {
    teacherId,
    isAdmin: false,
    name: "  Listening de Animais  ",
    description: "  Compreensão auditiva  ",
    difficulty: ActivityDifficulty.MEDIUM,
    content,
  };

  const editInput: CreateListeningActivityBody & { slug: string; teacherId: string; isAdmin: boolean } = {
    slug,
    teacherId,
    isAdmin: false,
    name: "  Listening atualizado  ",
    description: "  Texto atualizado  ",
    difficulty: ActivityDifficulty.HARD,
    content,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = teacherId;
    activity.slug = slug;
    activity.type = ActivityType.LISTENING;
    activity.status = ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    version = new ActivityVersion();
    version.id = "version-123";
    version.activityId = activity.id;
    version.versionNumber = 1;
    version.name = "Listening";
    version.description = null;
    version.difficulty = ActivityDifficulty.MEDIUM;
    version.timeLimitSeconds = 900;
    version.content = content;
    version.status = ActivityVersionStatus.DRAFT;
    version.revision = 1;
    version.submittedAt = null;
    version.publishedAt = null;
    version.generatedData = null;
    version.reviewFeedback = null;
    version.reviewedAt = null;
    activity.versions = [version];

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

  it("cria o Listening como rascunho e não reaproveita áudio recebido no payload", async () => {
    const result = await new CreateListeningActivityService(manager, activityRepository, versionRepository).execute(createInput);
    const passages = result.version.content.passages as Array<{ audio: Record<string, unknown> }>;

    expect(result.activity).toMatchObject({
      type: ActivityType.LISTENING,
      status: ActivityStatus.DRAFT,
      currentPublishedVersionId: null,
    });
    expect(result.version).toMatchObject({
      name: "Listening de Animais",
      description: "Compreensão auditiva",
      status: ActivityVersionStatus.DRAFT,
      timeLimitSeconds: 900,
    });
    expect(passages[0]?.audio).toMatchObject({
      storageKey: null,
      publicUrl: null,
      status: "PENDING",
      model: null,
      voice: null,
      textHash: null,
    });
  });

  it("publica imediatamente quando a atividade é criada por administrador", async () => {
    const result = await new CreateListeningActivityService(manager, activityRepository, versionRepository)
      .execute({ ...createInput, isAdmin: true });

    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe(result.version.id);
    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(saveActivity).toHaveBeenCalledTimes(2);
  });

  it("mantém o áudio quando o texto do trecho não mudou", async () => {
    const result = await new EditListeningActivityService(manager, activityRepository, versionRepository).execute(editInput);
    const passages = result.version.content.passages as Array<{ audio: Record<string, unknown> }>;

    expect(result.version).toBe(version);
    expect(result.version.revision).toBe(2);
    expect(passages[0]?.audio).toMatchObject({
      storageKey: passage.audio.storageKey,
      publicUrl: passage.audio.publicUrl,
      status: "READY",
      sizeBytes: passage.audio.sizeBytes,
    });
  });

  it("invalida o áudio quando o texto do trecho é alterado", async () => {
    const changedContent = {
      ...content,
      passages: [{ ...passage, text: "O cachorro corre.", blanks: [{ id: "blank-1", startOffset: 2, endOffset: 10, expectedAnswer: "cachorro", alternatives: [] }] }],
    };
    const result = await new EditListeningActivityService(manager, activityRepository, versionRepository)
      .execute({ ...editInput, content: changedContent });
    const passages = result.version.content.passages as Array<{ audio: Record<string, unknown> }>;

    expect(passages[0]?.audio).toMatchObject({
      storageKey: null,
      publicUrl: null,
      status: "STALE",
      model: null,
      voice: null,
      textHash: null,
    });
  });

  it("impede edição quando há uma versão aguardando revisão", async () => {
    version.status = ActivityVersionStatus.PENDING_REVIEW;

    await expect(new EditListeningActivityService(manager, activityRepository, versionRepository).execute(editInput))
      .rejects.toMatchObject({ code: "ACTIVITY_VERSION_PENDING_REVIEW", statusCode: 409 });

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("impede edição por outro professor ou de atividade de outro tipo", async () => {
    await expect(new EditListeningActivityService(manager, activityRepository, versionRepository)
      .execute({ ...editInput, teacherId: "other-teacher" }))
      .rejects.toMatchObject({ code: "ACTIVITY_NOT_FOUND", statusCode: 404 });

    activity.type = ActivityType.MEMORY;
    await expect(new EditListeningActivityService(manager, activityRepository, versionRepository).execute(editInput))
      .rejects.toMatchObject({ code: "ACTIVITY_TYPE_NOT_SUPPORTED", statusCode: 422 });

    expect(saveVersion).not.toHaveBeenCalled();
  });
});
