import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthError } from "../../auth/errors/AuthError";
import { makeTeacherStudentService } from "../factories/make-teacher-student-service";

export async function listStudentRelationshipsController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  try {
    const result = await makeTeacherStudentService().listStudentRelationships(request.user.sub);
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AuthError) return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error({ err: error }, "Falha ao listar convites do aluno.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
