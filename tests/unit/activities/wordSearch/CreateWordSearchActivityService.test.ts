import type { EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Activity } from "../../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../../src/modules/activities/entities/ActivityVersion";
import { CreateWordSearchActivityService } from "../../../../src/modules/activities/services/CreateWordSearchActivityService";
import { ActivityDifficulty } from "../../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../../src/modules/activities/types/ActivityVisibility";
import type { IActivityRepository } from "../../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import * as wordSearchGenerator from "../../../../src/modules/activities/utils/wordSearch/generateWordSearchPuzzle";
import { WordSearchPlacementError } from "../../../../src/modules/activities/errors/WordSearchPlacementError";

describe("CreateWordSearchActivityService", () => {
    let service: CreateWordSearchActivityService;
    let activityRepository: IActivityRepository;
    let activityVersionRepository: IActivityVersionRepository;
    let manager: EntityManager;

    const input = {        
        teacherId: "teacher-123",
        isAdmin: false,
        name: "Animais brasileiros",
        description: "Encontre os animais",
        difficulty: ActivityDifficulty.EASY,
        words: ["GATO", "CACHORRO", "LEÃO"],
    };

    beforeEach(() => {
        vi.restoreAllMocks();

        vi.clearAllMocks();

        manager = {} as EntityManager;

        activityRepository = {
            findById: vi.fn(),
            findBySlug: vi.fn().mockResolvedValue(null),
            findBySlugWithVersions: vi.fn(),
            findByIdAndTeacherId: vi.fn(),
            findBySlugAndTeacherId: vi.fn(),
            save: vi.fn().mockImplementation(
                async (_manager: EntityManager, activity: Activity) => activity,
            ),
            list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
            updatePublishedVersion: vi.fn().mockResolvedValue(undefined),
        };

        activityVersionRepository = {
        findById: vi.fn(),
        findByActivityIdAndVersionNumber: vi.fn(),
        findByActivityId: vi.fn(),
        findByActivityIdAndStatus: vi.fn(),
        findLatestByActivityId: vi.fn(),
        save: vi.fn().mockImplementation(
            async (_manager: EntityManager, version: ActivityVersion) => version,
        ),
        };

        service = new CreateWordSearchActivityService(
        manager,
        activityRepository,
        activityVersionRepository,
        );
    });

    it("deve criar a atividade e sua primeira versão", async () => {
        const result = await service.execute(input);

        expect(result.activity).toBeInstanceOf(Activity);
        expect(result.version).toBeInstanceOf(ActivityVersion);

        expect(result.activity.teacherId).toBe(input.teacherId);
        expect(result.activity.type).toBe(ActivityType.WORD_SEARCH);
        expect(result.activity.status).toBe(ActivityStatus.DRAFT);
        expect(result.activity.visibility).toBe(
        ActivityVisibility.AUTHENTICATED,
        );

        expect(result.version.versionNumber).toBe(1);
        expect(result.version.name).toBe(input.name);
        expect(result.version.difficulty).toBe(input.difficulty);
        expect(result.version.status).toBe(ActivityVersionStatus.DRAFT);

        expect(result.preview.grid.length).toBeGreaterThan(0);
        expect(result.preview.words).toEqual(input.words);

        expect(activityRepository.save).toHaveBeenCalledOnce();
        expect(activityVersionRepository.save).toHaveBeenCalledOnce();
    });

    it("deve usar o limite padrão de 15 minutos quando não informado", async () => {
        const result = await service.execute(input);

        expect(result.version.timeLimitSeconds).toBe(900);
    });

    it("deve preservar null quando a atividade não tiver limite de tempo", async () => {
        const result = await service.execute({
        ...input,
        timeLimitSeconds: null,
        });

        expect(result.version.timeLimitSeconds).toBeNull();
    });

    it("deve gerar outro slug quando o primeiro já estiver em uso", async () => {
        vi.mocked(activityRepository.findBySlug)
        .mockResolvedValueOnce({ id: "existing-activity" } as Activity)
        .mockResolvedValueOnce(null);

        const result = await service.execute(input);

        expect(activityRepository.findBySlug).toHaveBeenCalledTimes(2);
        expect(result.activity.slug).not.toBe("");
        expect(result.activity.slug).not.toBe("animais-brasileiros");
    });

    it("deve rejeitar conteúdo com palavras duplicadas após a normalização", async () => {
        await expect(
        service.execute({
            ...input,
            words: ["LEÃO", "LEAO", "GATO"],
        }),
        ).rejects.toThrow();

        expect(activityRepository.save).not.toHaveBeenCalled();
        expect(activityVersionRepository.save).not.toHaveBeenCalled();
    });

    it("deve propagar uma falha ao salvar a versão", async () => {
        vi.mocked(activityVersionRepository.save).mockRejectedValueOnce(
        new Error("Erro ao salvar versão"),
        );

        await expect(service.execute(input)).rejects.toThrow();

        expect(activityRepository.save).toHaveBeenCalledOnce();
        expect(activityVersionRepository.save).toHaveBeenCalledOnce();
    });

    it("deve lançar AppError quando a geração do caça-palavras falhar", async () => {
        vi.spyOn(
            wordSearchGenerator,
            "generateWordSearchPuzzle",
        ).mockImplementation(() => {
            throw new WordSearchPlacementError();
        });

        await expect(service.execute(input)).rejects.toMatchObject({
            code: "WORD_SEARCH_GENERATION_FAILED",
            statusCode: 422,
        });

        expect(activityRepository.save).not.toHaveBeenCalled();
        expect(activityVersionRepository.save).not.toHaveBeenCalled();
    });

    it("deve lançar AppError quando não conseguir gerar um slug único após 100 tentativas", async () => {
    vi.mocked(activityRepository.findBySlug).mockResolvedValue(
        { id: "existing-activity" } as Activity,
    );

    await expect(service.execute(input)).rejects.toMatchObject({
        code: "ACTIVITY_SLUG_GENERATION_FAILED",
        statusCode: 500,
    });

    expect(activityRepository.findBySlug).toHaveBeenCalledTimes(100);
    expect(activityRepository.save).not.toHaveBeenCalled();
    expect(activityVersionRepository.save).not.toHaveBeenCalled();
    });

    it("deve persistir as palavras validadas em content e a grade em generatedData", async () => {
        await service.execute(input);

        expect(activityVersionRepository.save).toHaveBeenCalledOnce();

        const [, savedVersion] = vi.mocked(
            activityVersionRepository.save,
        ).mock.calls[0];

        expect(savedVersion.generatedData).not.toBeNull();

        expect(savedVersion.generatedData).toEqual(
            expect.objectContaining({
                grid: expect.any(Array),
                wordPositions: expect.any(Array),
            }),
        );

        expect(
            (savedVersion.generatedData as Record<string, unknown>).grid,
        ).toBeDefined();

        expect(
            (savedVersion.generatedData as Record<string, unknown>).wordPositions,
        ).toBeDefined();
    });
});