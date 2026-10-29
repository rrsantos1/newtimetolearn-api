import type { FastifyInstance } from "fastify";
import { getUserProfileController } from "../controllers/getUserProfileController";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { updateUserProfileController } from "../controllers/updateUserProfileController";

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/me",
    { preHandler: authMiddleware },
    getUserProfileController,
  );

  app.patch(
    "/me",
    { preHandler: authMiddleware },
    updateUserProfileController,
  );
}