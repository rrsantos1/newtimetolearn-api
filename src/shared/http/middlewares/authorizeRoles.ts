import type { FastifyReply, FastifyRequest } from "fastify";
import { RoleCode } from "../../../modules/users/types/RoleCode";

export function authorizeRoles(...allowedRoles: RoleCode[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const user = request.user;

    if (!user) {
      await reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Autenticação necessária.",
        },
        requestId: request.id,
      });
      return;
    }

    const hasPermission = user.roles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!hasPermission) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Você não tem permissão para executar esta ação.",
        },
        requestId: request.id,
      });
    }
  };
}