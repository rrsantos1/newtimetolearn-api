import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { CreateQuizActivityService } from "../../src/modules/activities/services/CreateQuizActivityService";
import type { IActivityRepository } from "../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../src/modules/activities/types/ActivityVisibility";
import { ActivityDifficulty } from "../../src/modules/activities/types/ActivityDifficulty";
import type { CreateQuizActivityInput } from "../../src/modules/activities/types/quiz/CreateQuizActivityInput";

describe("CreateQuizActivityService", () => {
  let service: CreateQuizActivityService;
  let activityRepository: IActivityRepository;
  let activityVersionRepository: IActivityVersionRepository;
  let findBySlug: ReturnType<typeof vi.fn>;
  let saveActivity: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;

  const input: CreateQuizActivityInput = {
    teacherId: "teacher-123",
    isAdmin: false,
    name: "  Sistema Solar  ",
    description: "  Avaliação de ciências  ",
    difficulty: ActivityDifficulty.MEDIUM,
    content: {
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
    },
  };

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

    service = new CreateQuizActivityService(
      {} as EntityManager,
      activityRepository,
      activityVersionRepository,
    );
  });

  it("cria o Quiz como rascunho para um professor", async () => {
    const result = await service.execute(input);

    expect(result.activity).toMatchObject({
      id: "activity-123",
      teacherId: input.teacherId,
      type: ActivityType.QUIZ,
      status: ActivityStatus.DRAFT,
      visibility: ActivityVisibility.AUTHENTICATED,
      executionCount: 0,
      currentPublishedVersionId: null,
    });
    expect(result.version).toMatchObject({
      id: "version-123",
      activityId: "activity-123",
      versionNumber: 1,
      name: "Sistema Solar",
      description: "Avaliação de ciências",
      difficulty: ActivityDifficulty.MEDIUM,
      status: ActivityVersionStatus.DRAFT,
      revision: 1,
      content: input.content,
    });
    expect(result.version.timeLimitSeconds).toBe(900);
    expect(updatePublishedVersion).not.toHaveBeenCalled();
  });

  it("publica imediatamente o Quiz criado por um administrador", async () => {
    const result = await service.execute({ ...input, isAdmin: true });

    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe("version-123");
    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(saveActivity).toHaveBeenCalledTimes(2);
  });

  it("gera outro slug quando o primeiro já está em uso", async () => {
    findBySlug
      .mockResolvedValueOnce({ id: "existing-activity" })
      .mockResolvedValueOnce(null);

    const result = await service.execute(input);

    expect(findBySlug).toHaveBeenCalledTimes(2);
    expect(result.activity.slug).not.toBe("");
  });

  it("rejeita conteúdo inválido antes de persistir a atividade", async () => {
    const invalidInput = {
      ...input,
      content: {
        questions: [
          {
            id: "question-1",
            statement: "Pergunta",
            options: [
              { id: "option-1", text: "A", images: [] },
              { id: "option-2", text: "B", images: [] },
              { id: "option-3", text: "C", images: [] },
            ],
            correctOptionId: "option-inexistente",
          },
        ],
      },
    } as unknown as CreateQuizActivityInput;

    await expect(service.execute(invalidInput)).rejects.toThrow();
    expect(saveActivity).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
  });
});
