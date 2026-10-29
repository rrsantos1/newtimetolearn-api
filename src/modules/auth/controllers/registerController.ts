import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeRegisterService } from "../factories/make-register-service";
import { registerSchema } from "../schemas/registerSchema";

export async function registerController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = registerSchema.parse(request.body);
    const service = makeRegisterService();
    const result = await service.execute(input);

    return reply.status(201).send({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados informados são inválidos.",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        requestId: request.id,
      });
    }

    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Falha no cadastro de usuário");

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível concluir o cadastro.",
      },
      requestId: request.id,
    });
  }
}