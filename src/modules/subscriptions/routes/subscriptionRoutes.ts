import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { RoleCode } from "../../users/types/RoleCode";
import { getMyEntitlementsController } from "../controllers/getMyEntitlementsController";

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  app.get("/me/entitlements", { preHandler: authorizeRoles(RoleCode.TEACHER) }, getMyEntitlementsController);
}
