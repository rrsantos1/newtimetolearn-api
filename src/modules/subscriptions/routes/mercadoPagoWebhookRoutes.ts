import type { FastifyInstance } from "fastify";
import { mercadoPagoWebhookController } from "../controllers/mercadoPagoWebhookController";

export async function mercadoPagoWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/mercado-pago", {
    config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
  }, mercadoPagoWebhookController);
}
