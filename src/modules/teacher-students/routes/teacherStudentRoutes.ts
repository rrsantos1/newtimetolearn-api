import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { RoleCode } from "../../users/types/RoleCode";
import { searchStudentController } from "../controllers/searchStudentController";
import { inviteStudentController } from "../controllers/inviteStudentController";
import { listTeacherRelationshipsController } from "../controllers/listTeacherRelationshipsController";
import { listStudentRelationshipsController } from "../controllers/listStudentRelationshipsController";
import { respondInvitationController } from "../controllers/respondInvitationController";
import { cancelInvitationController } from "../controllers/cancelInvitationController";
import { endRelationshipController } from "../controllers/endRelationshipController";

export async function teacherStudentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  app.get("/students/search", {
    preHandler: authorizeRoles(RoleCode.TEACHER),
  }, searchStudentController);

  app.post("/invitations", {
    preHandler: authorizeRoles(RoleCode.TEACHER),
  }, inviteStudentController);

  app.get("/teacher/relationships", {
    preHandler: authorizeRoles(RoleCode.TEACHER),
  }, listTeacherRelationshipsController);

  app.get("/student/relationships", {
    preHandler: authorizeRoles(RoleCode.STUDENT),
  }, listStudentRelationshipsController);

  app.patch("/student/relationships/:relationshipId/respond", {
    preHandler: authorizeRoles(RoleCode.STUDENT),
  }, respondInvitationController);

  app.patch("/teacher/invitations/:relationshipId/cancel", {
    preHandler: authorizeRoles(RoleCode.TEACHER),
  }, cancelInvitationController);

  app.patch("/teacher/relationships/:relationshipId/end", {
    preHandler: authorizeRoles(RoleCode.TEACHER),
  }, endRelationshipController);
}
