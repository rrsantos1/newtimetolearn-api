import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { authorizeRoles } from "../../../shared/http/middlewares/authorizeRoles";
import { RoleCode } from "../../users/types/RoleCode";
import {
  createNotebookEntryController,
  createNotebookNoteController,
  getNotebookController,
  listNotebookNotesController,
  reorderNotebookEntriesController,
} from "../controllers/notebookControllers";

export async function notebookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);
  const roles = [RoleCode.TEACHER, RoleCode.STUDENT];

  app.get<{ Params: { relationshipId: string } }>(
    "/:relationshipId",
    { preHandler: authorizeRoles(...roles) },
    getNotebookController,
  );
  app.post<{ Params: { relationshipId: string } }>(
    "/:relationshipId/entries",
    { preHandler: authorizeRoles(RoleCode.TEACHER) },
    createNotebookEntryController,
  );
  app.patch<{ Params: { relationshipId: string } }>(
    "/:relationshipId/entries/reorder",
    { preHandler: authorizeRoles(RoleCode.TEACHER) },
    reorderNotebookEntriesController,
  );
  app.get<{ Params: { relationshipId: string } }>(
    "/:relationshipId/notes",
    { preHandler: authorizeRoles(...roles) },
    listNotebookNotesController,
  );
  app.post<{ Params: { relationshipId: string } }>(
    "/:relationshipId/notes",
    { preHandler: authorizeRoles(...roles) },
    createNotebookNoteController,
  );
}
