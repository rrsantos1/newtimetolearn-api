import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";
import { ProcessMercadoPagoWebhookService } from "../services/ProcessMercadoPagoWebhookService";
const webhookSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(), type: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }),
}).passthrough();
export async function mercadoPagoWebhookController(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  if (env.MERCADO_PAGO_ENABLED !== "true") return reply.status(503).send({ success: false, error: { code: "PAYMENTS_DISABLED" } });
  const parsed = webhookSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ success: false, error: { code: "INVALID_WEBHOOK" } });
  const query = request.query as Record<string, string | undefined>;
  const dataId = String(parsed.data.data.id);
  const signature = request.headers["x-signature"];
  const requestId = request.headers["x-request-id"];
  const provider = new MercadoPagoProvider();
  if (!provider.validateWebhookSignature(
    typeof signature === "string" ? signature : undefined,
    typeof requestId === "string" ? requestId : undefined,
    query["data.id"] ?? dataId,
  )) return reply.status(401).send({ success: false, error: { code: "INVALID_WEBHOOK_SIGNATURE" } });
  const eventType = parsed.data.type ?? query.type ?? "";
  if (!["subscription_preapproval", "subscription_authorized_payment"].includes(eventType)) {
    return reply.status(200).send({ success: true, data: { ignored: true } });
  }
  try {
    const eventId = String(parsed.data.id ?? `${requestId ?? "notification"}:${dataId}`);
    const service = new ProcessMercadoPagoWebhookService(new SubscriptionPaymentRepository(), provider);
    await service.execute({ eventId, eventType, dataId, payload: parsed.data });
    return reply.status(200).send({ success: true });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao processar webhook do Mercado Pago.");
    return reply.status(500).send({ success: false, error: { code: "WEBHOOK_PROCESSING_FAILED" } });
  }
}