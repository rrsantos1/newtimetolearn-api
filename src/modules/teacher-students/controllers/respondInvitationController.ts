import type { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeTeacherStudentService } from "../factories/make-teacher-student-service";

const paramsSchema = z.object({ relationshipId: z.uuid() });
const bodySchema = z.object({ accept: z.boolean() });

export async function respondInvitationController(request: FastifyRequest<{ Params: { relationshipId: string } }>, reply: FastifyReply): Promise<FastifyReply> {
  try {
    const { relationshipId } = paramsSchema.parse(request.params);
    const { accept } = bodySchema.parse(request.body);
    const result = await makeTeacherStudentService().respondToInvitation(request.user.sub, relationshipId, accept);
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Dados de resposta inválidos." }, requestId: request.id });
    if (error instanceof AuthError) return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error({ err: error }, "Falha ao responder convite.");
    return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
  }
}
