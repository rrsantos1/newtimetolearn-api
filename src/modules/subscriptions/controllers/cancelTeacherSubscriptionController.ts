import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthError } from "../../auth/errors/AuthError";
import { env } from "../../../shared/config/env";
import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";
import { CancelTeacherSubscriptionService } from "../services/CancelTeacherSubscriptionService";
export async function cancelTeacherSubscriptionController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  if (env.MERCADO_PAGO_ENABLED !== "true") {
    return reply.status(503).send({ success: false, error: { code: "PAYMENTS_DISABLED", message: "O gerenciamento de pagamentos está temporariamente indisponível." }, requestId: request.id });
  }
  try {
    const service = new CancelTeacherSubscriptionService(new SubscriptionPaymentRepository(), new MercadoPagoProvider());
    await service.execute(request.user.sub);
    return reply.status(200).send({ success: true, data: { status: "CANCELLED" }, requestId: request.id });
  } catch (error: unknown) {
    if (error instanceof AuthError) return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error({ err: error }, "Falha ao cancelar assinatura.");
    return reply.status(502).send({ success: false, error: { code: "SUBSCRIPTION_CANCELLATION_FAILED", message: "Não foi possível cancelar a assinatura." }, requestId: request.id });
  }
}