import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { listNotificationsController } from "../controllers/listNotificationsController";
import { markAllNotificationsReadController } from "../controllers/markAllNotificationsReadController";
import { markNotificationReadController } from "../controllers/markNotificationReadController";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  app.get("/", listNotificationsController);
  app.patch("/read-all", markAllNotificationsReadController);
  app.patch<{ Params: { notificationId: string } }>(
    "/:notificationId/read",
    markNotificationReadController,
  );
}
