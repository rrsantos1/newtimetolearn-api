import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeTeacherStudentService } from "../factories/make-teacher-student-service";
import { createInvitationSchema } from "../schemas/createInvitationSchema";

export async function searchStudentController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  try {
    const { email } = createInvitationSchema.parse(request.query);
    const result = await makeTeacherStudentService().searchStudentByEmail(email);
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Informe um e-mail válido." }, requestId: request.id });
    if (error instanceof AuthError) return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error({ err: error }, "Falha ao pesquisar aluno.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
