import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { RoleCode } from "../../users/types/RoleCode";
import { createTeacherSubscriptionController } from "../controllers/createTeacherSubscriptionController";
import { getMyEntitlementsController } from "../controllers/getMyEntitlementsController";

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  app.get("/me/entitlements", { preHandler: authorizeRoles(RoleCode.TEACHER) }, getMyEntitlementsController);
  app.post("/checkout", { preHandler: authorizeRoles(RoleCode.TEACHER), config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, createTeacherSubscriptionController);
}
