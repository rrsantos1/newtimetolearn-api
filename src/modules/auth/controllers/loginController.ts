import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../errors/AuthError";
import { makeLoginService } from "../factories/make-login-service";
import { loginSchema } from "../schemas/loginSchema";

export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const input = loginSchema.parse(request.body);
    const loginService = makeLoginService(request.server);
    const result = await loginService.execute(input);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados de entrada inválidos.",
        },
        requestId: request.id,
      });
    }

    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: getAuthErrorMessage(error.code),
        },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Erro ao realizar login.");

    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno.",
      },
      requestId: request.id,
    });
  }
}

function getAuthErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "E-mail ou senha inválidos.";
    case "EMAIL_NOT_VERIFIED":
      return "Confirme seu e-mail antes de entrar.";
    case "ACCOUNT_BLOCKED":
      return "Esta conta está bloqueada.";
    default:
      return "Não foi possível realizar o login.";
  }
}