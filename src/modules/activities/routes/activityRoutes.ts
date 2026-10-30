import type { FastifyInstance } from "fastify";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { RoleCode } from "../../users/types/RoleCode";
import { createWordSearchActivityController } from "../controllers/createWordSearchActivityController";
import { createCrosswordActivityController } from "../controllers/createCrosswordActivityController";
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

export async function activityRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    createWordSearchActivityController,
  );

  app.get(
    "/",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    listActivitiesController,
  );

  app.post(
    "/crossword",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    createCrosswordActivityController,
  );

  app.get(
    "/:slug/ranking",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT),
      ],
    },
    getWordSearchRankingController,
  );

  app.post(
    "/:slug/attempts",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.STUDENT),
      ],
    },
    submitWordSearchAttemptController,
  );

  app.get(
    "/:slug/attempts",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    listActivityAttemptsController,
  );

  app.get(
    "/:slug",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN, RoleCode.STUDENT),
      ],
    },
    getActivityBySlugController,
  );

  app.patch(
    "/:slug",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    updateWordSearchActivityController,
  );

  app.patch(
    "/:slug/approve",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.ADMIN),
      ],
    },
    approveActivityVersionController,
  );

  app.patch(
    "/:slug/review",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.ADMIN),
      ],
    },
    reviewActivityVersionController,
  );

  app.patch(
    "/:slug/submit",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    submitActivityVersionController,
  );

  app.delete(
    "/:slug",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
      ],
    },
    deleteActivityController,
  );
}
