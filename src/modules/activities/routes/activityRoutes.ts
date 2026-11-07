import type { FastifyInstance } from "fastify";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { RoleCode } from "../../users/types/RoleCode";
import { createWordSearchActivityController } from "../controllers/createWordSearchActivityController";
import { createCrosswordActivityController } from "../controllers/createCrosswordActivityController";
import { createQuizActivityController } from "../controllers/createQuizActivityController";
import { createListeningActivityController } from "../controllers/createListeningActivityController";
import { editListeningActivityController } from "../controllers/editListeningActivityController";
import { generateListeningAudioController } from "../controllers/generateListeningAudioController";
import { generateListeningAudioPreviewController } from "../controllers/generateListeningAudioPreviewController";
import { createMemoryActivityController } from "../controllers/createMemoryActivityController";
import { createMoleHitActivityController } from "../controllers/createMoleHitActivityController";
import { editMoleHitActivityController } from "../controllers/editMoleHitActivityController";
import { submitMoleHitAttemptController } from "../controllers/submitMoleHitAttemptController";
import { getMoleHitRankingController } from "../controllers/getMoleHitRankingController";
import { editMemoryActivityController } from "../controllers/editMemoryActivityController";
import { submitMemoryAttemptController } from "../controllers/submitMemoryAttemptController";
import { submitListeningAttemptController } from "../controllers/submitListeningAttemptController";
import { listListeningAttemptsController } from "../controllers/listListeningAttemptsController";
import { editQuizActivityController } from "../controllers/editQuizActivityController";
import { editCrosswordActivityController } from "../controllers/editCrosswordActivityController";
import { getActivityBySlugController } from "../controllers/getActivityBySlugController";
import { listActivitiesController } from "../controllers/listActivitiesController";
import { setActivityFavoriteController } from "../controllers/setActivityFavoriteController";
import { updateActivityVisibilityController } from "../controllers/updateActivityVisibilityController";
import { listPublicActivitiesController } from "../controllers/listPublicActivitiesController";
import { getPublicActivityBySlugController } from "../controllers/getPublicActivityBySlugController";
import { updateWordSearchActivityController } from "../controllers/updateWordSearchActivityController";
import { approveActivityVersionController } from "../controllers/approveActivityVersionController";
import { reviewActivityVersionController } from "../controllers/reviewActivityVersionController";
import { submitActivityVersionController } from "../controllers/submitActivityVersionController";
import { deleteActivityController } from "../controllers/deleteActivityController";
import { submitWordSearchAttemptController } from "../controllers/submitWordSearchAttemptController";
import { listActivityAttemptsController } from "../controllers/listActivityAttemptsController";
import { getWordSearchRankingController } from "../controllers/getWordSearchRankingController";
import { createMediaAssetController } from "../controllers/createMediaAssetController";
import { listMediaAssetsController } from "../controllers/listMediaAssetsController";
import { listPendingMediaAssetsController } from "../controllers/listPendingMediaAssetsController";
import { reviewMediaAssetController } from "../controllers/reviewMediaAssetController";
import { getQuarantinedMediaAssetController } from "../controllers/getQuarantinedMediaAssetController";
import { generateAiActivitySuggestionsController } from "../controllers/generateAiActivitySuggestionsController";
import { makeCreateDragDropActivityController } from "../controllers/createDragDropActivityController";
import { ActivityType } from "../types/ActivityType";
import { makeSubmitDragDropActivityAttemptController } from "../controllers/submitDragDropActivityAttemptController";
import { makeGetDragDropActivityRankingController } from "../controllers/getDragDropActivityRankingController";
import { makeEditDragDropActivityController } from "../controllers/editDragDropActivityController";
import { updateActivityCoverController } from "../controllers/updateActivityCoverController";
import { generateActivityCoverController } from "../controllers/generateActivityCoverController";
import { createActivityCoverGenerationController } from "../controllers/createActivityCoverGenerationController";
import { getActivityCoverGenerationController } from "../controllers/getActivityCoverGenerationController";
import { cleanupOrphanMediaFilesController } from "../controllers/cleanupOrphanMediaFilesController";
import { getMediaStorageUsageController } from "../controllers/getMediaStorageUsageController";

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/public", listPublicActivitiesController);
  app.get("/public/:slug", getPublicActivityBySlugController);
  app.put("/:slug/favorite", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, setActivityFavoriteController);
  app.patch("/:slug/visibility", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, updateActivityVisibilityController);
  app.post("/ai/suggestions", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, generateAiActivitySuggestionsController);
  app.post("/ai/listening-audio", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } }, preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, generateListeningAudioPreviewController);
  app.post("/", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createWordSearchActivityController);

  app.post("/ai/activity-cover", { config: { rateLimit: { max: 3, timeWindow: "1 minute" } }, preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createActivityCoverGenerationController);
  app.get<{ Params: { jobId: string } }>("/ai/activity-cover/:jobId", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, getActivityCoverGenerationController);
  app.patch("/:slug/cover", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, updateActivityCoverController);
  app.get("/media-library", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, listMediaAssetsController);
  app.get("/media-library/storage-usage", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, getMediaStorageUsageController);
  app.get("/media-library/review", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, listPendingMediaAssetsController);
  app.get("/media-library/:id/preview", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, getQuarantinedMediaAssetController);
  app.patch("/media-library/:id/review", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, reviewMediaAssetController);
  app.post("/media-library/cleanup-orphans", { config: { rateLimit: { max: 3, timeWindow: "1 minute" } }, preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, cleanupOrphanMediaFilesController);
  app.post("/media-library/upload", {
    bodyLimit: 5 * 1024 * 1024,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)],
  }, createMediaAssetController);

  app.post("/quiz", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createQuizActivityController);
  app.post("/listening", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createListeningActivityController);
  app.patch("/:slug/listening", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, editListeningActivityController);
  app.post("/:slug/listening/passages/:passageId/audio", {
    bodyLimit: 30 * 1024 * 1024,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)],
  }, generateListeningAudioController);
  app.post("/memory", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createMemoryActivityController);
  app.post("/mole-hit", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createMoleHitActivityController);
  app.patch("/:slug/mole-hit", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, editMoleHitActivityController);
  app.post("/:slug/mole-hit/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, submitMoleHitAttemptController);
  app.get("/:slug/mole-hit/ranking", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, getMoleHitRankingController);
  app.post("/multiple-choice", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, makeCreateDragDropActivityController(ActivityType.MULTIPLE_CHOICE));
  app.patch("/:slug/multiple-choice", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, makeEditDragDropActivityController(ActivityType.MULTIPLE_CHOICE));
  app.post("/:slug/multiple-choice/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, makeSubmitDragDropActivityAttemptController(ActivityType.MULTIPLE_CHOICE));
  app.get("/:slug/multiple-choice/ranking", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, makeGetDragDropActivityRankingController(ActivityType.MULTIPLE_CHOICE));
  app.post("/word-matching", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, makeCreateDragDropActivityController(ActivityType.WORD_MATCHING));
  app.post("/sentence-completion", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, makeCreateDragDropActivityController(ActivityType.SENTENCE_COMPLETION));
  app.patch("/:slug/word-matching", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, makeEditDragDropActivityController(ActivityType.WORD_MATCHING));
  app.patch("/:slug/sentence-completion", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, makeEditDragDropActivityController(ActivityType.SENTENCE_COMPLETION));
  app.post("/:slug/word-matching/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, makeSubmitDragDropActivityAttemptController(ActivityType.WORD_MATCHING));
  app.post("/:slug/sentence-completion/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, makeSubmitDragDropActivityAttemptController(ActivityType.SENTENCE_COMPLETION));
  app.get("/:slug/word-matching/ranking", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, makeGetDragDropActivityRankingController(ActivityType.WORD_MATCHING));
  app.get("/:slug/sentence-completion/ranking", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, makeGetDragDropActivityRankingController(ActivityType.SENTENCE_COMPLETION));
  app.post("/:slug/memory/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, submitMemoryAttemptController);
  app.post("/:slug/listening/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, submitListeningAttemptController);
  app.get("/:slug/listening/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, listListeningAttemptsController);
  app.patch("/:slug/memory", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, editMemoryActivityController);
  app.get("/", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, listActivitiesController);
  app.post("/crossword", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createCrosswordActivityController);
  app.get("/:slug/ranking", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, getWordSearchRankingController);
  app.post("/:slug/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, submitWordSearchAttemptController);
  app.get("/:slug/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, listActivityAttemptsController);
  app.get("/:slug", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT)] }, getActivityBySlugController);
  app.patch("/:slug/quiz", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, editQuizActivityController);
  app.patch("/:slug/crossword", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, editCrosswordActivityController);
  app.patch("/:slug", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, updateWordSearchActivityController);
  app.patch("/:slug/approve", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, approveActivityVersionController);
  app.patch("/:slug/review", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, reviewActivityVersionController);
  app.patch("/:slug/submit", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, submitActivityVersionController);
  app.delete("/:slug", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, deleteActivityController);
}
