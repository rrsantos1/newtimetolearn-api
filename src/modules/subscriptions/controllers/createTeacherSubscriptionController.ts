import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthError } from "../../auth/errors/AuthError";
import { env } from "../../../shared/config/env";
import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";
import { CreateTeacherSubscriptionService } from "../services/CreateTeacherSubscriptionService";

export async function createTeacherSubscriptionController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  if (env.MERCADO_PAGO_ENABLED !== "true") {
    return reply.status(503).send({
      success: false,
      error: { code: "PAYMENTS_DISABLED", message: "A contratação online está temporariamente indisponível." },
      requestId: request.id,
    });
  }

  try {
    const service = new CreateTeacherSubscriptionService(new SubscriptionPaymentRepository(), new MercadoPagoProvider());
    const result = await service.execute(request.user.sub);
    return reply.status(201).send({ success: true, data: result, requestId: request.id });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    if (error instanceof Error && error.message === "SUBSCRIPTION_ALREADY_EXISTS") {
      return reply.status(409).send({
        success: false,
        error: { code: "SUBSCRIPTION_ALREADY_EXISTS", message: "Já existe uma contratação pendente ou ativa." },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao iniciar checkout da assinatura.");
    return reply.status(502).send({
      success: false,
      error: { code: "SUBSCRIPTION_CHECKOUT_FAILED", message: "Não foi possível iniciar a contratação." },
      requestId: request.id,
    });
  }
}
