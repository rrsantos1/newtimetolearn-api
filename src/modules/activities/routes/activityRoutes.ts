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
import { createMemoryActivityController } from "../controllers/createMemoryActivityController";
import { editMemoryActivityController } from "../controllers/editMemoryActivityController";
import { submitMemoryAttemptController } from "../controllers/submitMemoryAttemptController";
import { editQuizActivityController } from "../controllers/editQuizActivityController";
import { editCrosswordActivityController } from "../controllers/editCrosswordActivityController";
import { getActivityBySlugController } from "../controllers/getActivityBySlugController";
import { listActivitiesController } from "../controllers/listActivitiesController";
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

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.post("/ai/suggestions", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, generateAiActivitySuggestionsController);
  app.post("/", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createWordSearchActivityController);

  app.get("/media-library", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, listMediaAssetsController);
  app.get("/media-library/review", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, listPendingMediaAssetsController);
  app.get("/media-library/:id/preview", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, getQuarantinedMediaAssetController);
  app.patch("/media-library/:id/review", { preHandler: [authMiddleware, authorizeRoles(RoleCode.ADMIN)] }, reviewMediaAssetController);
  app.post("/media-library/upload", {
    bodyLimit: 5 * 1024 * 1024,
    preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)],
  }, createMediaAssetController);

  app.post("/quiz", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createQuizActivityController);
  app.post("/listening", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createListeningActivityController);
  app.patch("/:slug/listening", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, editListeningActivityController);
  app.post("/:slug/listening/passages/:passageId/audio", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } }, preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, generateListeningAudioController);
  app.post("/memory", { preHandler: [authMiddleware, authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)] }, createMemoryActivityController);
  app.post("/:slug/memory/attempts", { preHandler: [authMiddleware, authorizeRoles(RoleCode.STUDENT)] }, submitMemoryAttemptController);
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
