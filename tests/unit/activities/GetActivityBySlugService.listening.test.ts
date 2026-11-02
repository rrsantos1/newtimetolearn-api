import { describe, expect, it, vi } from "vitest";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { GetActivityBySlugService } from "../../../src/modules/activities/services/GetActivityBySlugService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

describe("GetActivityBySlugService — Listening execution", () => {
  const teacherId = "teacher-123";
  const studentId = "student-123";
  const slug = "listening-animais";

  function createActivity(): Activity {
    const activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = teacherId;
    activity.slug = slug;
    activity.type = ActivityType.LISTENING;
    activity.status = ActivityStatus.PUBLISHED;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = "version-123";
    activity.deletedAt = null;

    const version = new ActivityVersion();
    version.id = "version-123";
    version.activityId = activity.id;
    version.versionNumber = 1;
    version.name = "Animais";
    version.description = "Complete o texto.";
    version.difficulty = "EASY";
    version.timeLimitSeconds = 900;
    version.status = ActivityVersionStatus.PUBLISHED;
    version.revision = 1;
    version.content = {
      language: "pt-BR",
      instructions: "Ouça e complete.",
      passages: [
        {
          id: "passage-1",
          title: "Texto 1",
          text: "O gato corre.",
          blanks: [
            {
              id: "blank-1",
              startOffset: 2,
              endOffset: 6,
              expectedAnswer: "gato",
              alternatives: ["felino"],
              grammarCategory: "substantivo",
            },
          ],
          audio: {
            storageKey: "listening/audio.mp3",
            publicUrl: "https://cdn.example.test/listening/audio.mp3",
            disclosure: "Áudio gerado por IA.",
            status: "READY",
            model: "tts-1",
            voice: "alloy",
            textHash: "hash",
            durationSeconds: 3,
          },
        },
      ],
    };
    activity.versions = [version];
    return activity;
  }

  function createService(activity: Activity): GetActivityBySlugService {
    const repository: IActivityRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      updatePublishedVersion: vi.fn(),
    };
    return new GetActivityBySlugService(repository);
  }

  it("não expõe respostas esperadas nem alternativas ao aluno", async () => {
    const result = await createService(createActivity()).execute({
      slug,
      userId: studentId,
      isAdmin: false,
    });
    const content = result.version.content as {
      passages: Array<{ blanks: Array<Record<string, unknown>> }>;
    };

    expect(content.passages[0]?.blanks[0]).toMatchObject({
      id: "blank-1",
      startOffset: 2,
      endOffset: 6,
      grammarCategory: "substantivo",
    });
    expect(content.passages[0]?.blanks[0]).not.toHaveProperty("expectedAnswer");
    expect(content.passages[0]?.blanks[0]).not.toHaveProperty("alternatives");
  });

  it("preserva as respostas esperadas para o professor proprietário", async () => {
    const result = await createService(createActivity()).execute({
      slug,
      userId: teacherId,
      isAdmin: false,
    });
    const content = result.version.content as {
      passages: Array<{ blanks: Array<Record<string, unknown>> }>;
    };

    expect(content.passages[0]?.blanks[0]).toMatchObject({
      expectedAnswer: "gato",
      alternatives: ["felino"],
    });
  });

  it("não permite que um aluno consulte uma atividade ainda não publicada", async () => {
    const activity = createActivity();
    activity.status = ActivityStatus.DRAFT;

    await expect(
      createService(activity).execute({
        slug,
        userId: studentId,
        isAdmin: false,
      }),
    ).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
  });
});
