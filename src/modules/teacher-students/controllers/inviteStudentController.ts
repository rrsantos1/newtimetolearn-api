import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeTeacherStudentService } from "../factories/make-teacher-student-service";
import { createInvitationSchema } from "../schemas/createInvitationSchema";

export async function inviteStudentController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  try {
    const { email } = createInvitationSchema.parse(request.body);
    const service = makeTeacherStudentService((error, channel) => {
      request.log.error({ err: error, channel }, "Falha ao entregar aviso do convite.");
    });
    const result = await service.inviteStudent(request.user.sub, email);
    return reply.status(201).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Informe um e-mail válido." }, requestId: request.id });
    if (error instanceof AuthError) return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error({ err: error }, "Falha ao enviar convite para aluno.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
