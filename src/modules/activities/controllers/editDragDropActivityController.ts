import type { FastifyReply, FastifyRequest } from "fastify";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { createDragDropActivitySchema } from "../schemas/createDragDropActivitySchema";
import { makeEditDragDropActivityService } from "../factories/make-edit-drag-drop-activity-service";
import type { DragDropActivityType } from "../services/CreateDragDropActivityService";
import { z } from "zod";

const paramsSchema = z.object({ slug: z.string().trim().min(1).max(150) });

export function makeEditDragDropActivityController(activityType: DragDropActivityType) {
  return async function editDragDropActivityController(request: FastifyRequest, reply: FastifyReply) {
    const params = paramsSchema.safeParse(request.params);
    const body = createDragDropActivitySchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados informados para editar a atividade são inválidos.",
          details: body.success ? undefined : body.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
        },
        requestId: request.id,
      });
    }

    try {
      const result = await AppDataSource.transaction(async (manager) => {
        const service = makeEditDragDropActivityService(manager, activityType);
        return service.execute({
          slug: params.data.slug,
          teacherId: request.user.sub,
          isAdmin: request.user.roles.includes(RoleCode.ADMIN),
          ...body.data,
        });
      });
      return reply.status(200).send({ success: true, data: result });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
      }
      request.log.error({ err: error }, "Falha ao editar atividade de arrastar e soltar.");
      return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
    }
  };
}
