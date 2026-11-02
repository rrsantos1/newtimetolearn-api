import type { FastifyReply, FastifyRequest } from "fastify";
import { AppDataSource } from "../../../shared/database/data-source";
import { AppError } from "../../../shared/errors/AppError";
import { RoleCode } from "../../users/types/RoleCode";
import { createDragDropActivitySchema } from "../schemas/createDragDropActivitySchema";
import { makeCreateDragDropActivityService } from "../factories/make-create-drag-drop-activity-service";
import type { DragDropActivityType } from "../services/CreateDragDropActivityService";

export function makeCreateDragDropActivityController(activityType: DragDropActivityType) {
  return async function createDragDropActivityController(request: FastifyRequest, reply: FastifyReply) {
    const parsedBody = createDragDropActivitySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados informados para a atividade são inválidos.",
          details: parsedBody.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
        },
        requestId: request.id,
      });
    }

    try {
      const result = await AppDataSource.transaction(async (manager) => {
        const service = makeCreateDragDropActivityService(manager, activityType);
        return service.execute({
          teacherId: request.user.sub,
          isAdmin: request.user.roles.includes(RoleCode.ADMIN),
          ...parsedBody.data,
        });
      });
      return reply.status(201).send({ success: true, data: result });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
          requestId: request.id,
        });
      }
      request.log.error({ err: error }, "Falha ao criar atividade de arrastar e soltar.");
      return reply.status(500).send({
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." },
        requestId: request.id,
      });
    }
  };
}
