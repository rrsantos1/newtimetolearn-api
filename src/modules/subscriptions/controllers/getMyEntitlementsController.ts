import type { FastifyReply, FastifyRequest } from "fastify";
import { makeTeacherEntitlementsService } from "../factories/make-teacher-entitlements-service";

export async function getMyEntitlementsController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  try {
    const service = makeTeacherEntitlementsService();
    const [entitlements, reservedStudents] = await Promise.all([
      service.getForTeacher(request.user.sub),
      service.countReservedStudents(request.user.sub),
    ]);
    return reply.status(200).send({
      success: true,
      data: {
        ...entitlements,
        reservedStudents,
        studentsRemaining: entitlements.studentLimit === null ? null : Math.max(0, entitlements.studentLimit - reservedStudents),
      },
      requestId: request.id,
    });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao consultar os benefícios da assinatura.");
    return reply.status(500).send({ success: false, error: { code: "TEACHER_ENTITLEMENTS_FAILED", message: "Não foi possível consultar os benefícios da conta." }, requestId: request.id });
  }
}
