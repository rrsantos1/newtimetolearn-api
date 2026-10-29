import type { FastifyInstance } from "fastify";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { RoleCode } from "../../users/types/RoleCode";
import { createWordSearchActivityController } from "../controllers/createWordSearchActivityController";
import { getActivityBySlugController } from "../controllers/getActivityBySlugController";
import { listActivitiesController } from "../controllers/listActivitiesController";
import { updateWordSearchActivityController } from "../controllers/updateWordSearchActivityController";
import { approveActivityVersionController } from "../controllers/approveActivityVersionController";
import { reviewActivityVersionController } from "../controllers/reviewActivityVersionController";

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

  app.get(
    "/:slug",
    {
      preHandler: [
        authMiddleware,
        authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN),
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
}