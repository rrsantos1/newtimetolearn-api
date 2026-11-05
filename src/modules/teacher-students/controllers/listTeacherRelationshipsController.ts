import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeTeacherStudentService } from "../factories/make-teacher-student-service";
import { listRelationshipsSchema } from "../schemas/listRelationshipsSchema";

export async function listTeacherRelationshipsController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  try {
    const { status } = listRelationshipsSchema.parse(request.query);
    const result = await makeTeacherStudentService().listTeacherRelationships(request.user.sub, status);
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Filtro de status inválido." }, requestId: request.id });
    if (error instanceof AuthError) return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error({ err: error }, "Falha ao listar alunos do professor.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
