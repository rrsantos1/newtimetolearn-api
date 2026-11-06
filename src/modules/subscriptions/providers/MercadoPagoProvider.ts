import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../../shared/config/env";
export interface MercadoPagoSubscription { id: string; status: string; init_point?: string; }
export interface MercadoPagoAuthorizedPayment { id: number | string; preapproval_id: string; summarized?: string; payment?: { status?: string }; }
export interface CreateMercadoPagoSubscriptionInput { teacherId: string; email: string; amountCents: number; idempotencyKey: string; }
export class MercadoPagoProvider {
  private readonly baseUrl = "https://api.mercadopago.com";
  async createSubscription(input: CreateMercadoPagoSubscriptionInput): Promise<MercadoPagoSubscription> {
    this.ensureEnabled();
    const response = await fetch(`${this.baseUrl}/preapproval`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        reason: "Assinatura Professor TimeToLearn", external_reference: input.teacherId, payer_email: input.email,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: input.amountCents / 100, currency_id: "BRL" },
        back_url: `${env.FRONTEND_URL}/teacher/subscription?checkout=return`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `MERCADO_PAGO_CREATE_SUBSCRIPTION_FAILED: HTTP ${response.status} - ${errorBody.slice(0, 1500)}`,
      );
    }

    return response.json() as Promise<MercadoPagoSubscription>;
  }
  async getSubscription(subscriptionId: string): Promise<MercadoPagoSubscription> {
    this.ensureEnabled();
    const response = await fetch(`${this.baseUrl}/preapproval/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("MERCADO_PAGO_GET_SUBSCRIPTION_FAILED");
    return response.json() as Promise<MercadoPagoSubscription>;
  }
  async getAuthorizedPayment(paymentId: string): Promise<MercadoPagoAuthorizedPayment> {
    this.ensureEnabled();
    const response = await fetch(`${this.baseUrl}/authorized_payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("MERCADO_PAGO_GET_AUTHORIZED_PAYMENT_FAILED");
    return response.json() as Promise<MercadoPagoAuthorizedPayment>;
  }
  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.ensureEnabled();
    const response = await fetch(`${this.baseUrl}/preapproval/${encodeURIComponent(subscriptionId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("MERCADO_PAGO_CANCEL_SUBSCRIPTION_FAILED");
  }
  validateWebhookSignature(signature: string | undefined, requestId: string | undefined, dataId: string | undefined): boolean {
    if (!signature || !env.MERCADO_PAGO_WEBHOOK_SECRET || !requestId || !dataId) return false;
    const fields = new Map<string, string>(signature.split(",").map((part): [string, string] => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 1) return ["", ""];

      return [
        part.slice(0, separatorIndex).trim(),
        part.slice(separatorIndex + 1).trim(),
      ];
    }));
    const timestamp = fields.get("ts");
    const receivedHash = fields.get("v1");
    if (!timestamp || !receivedHash) return false;
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const expectedHash = createHmac("sha256", env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
    const expected = Buffer.from(expectedHash, "hex");
    const received = Buffer.from(receivedHash, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
  private ensureEnabled(): void {
    if (env.MERCADO_PAGO_ENABLED !== "true") throw new Error("MERCADO_PAGO_DISABLED");
  }
}