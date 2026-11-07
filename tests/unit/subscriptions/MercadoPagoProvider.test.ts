import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../../src/shared/config/env";
import { MercadoPagoProvider } from "../../../src/modules/subscriptions/providers/MercadoPagoProvider";

describe("MercadoPagoProvider webhook signature", () => {
  const originalSecret = env.MERCADO_PAGO_WEBHOOK_SECRET;
  const originalEnabled = env.MERCADO_PAGO_ENABLED;
  const originalAccessToken = env.MERCADO_PAGO_ACCESS_TOKEN;
  const originalFetch = globalThis.fetch;
  const provider = new MercadoPagoProvider();

  afterEach(() => {
    env.MERCADO_PAGO_WEBHOOK_SECRET = originalSecret;
    env.MERCADO_PAGO_ENABLED = originalEnabled;
    env.MERCADO_PAGO_ACCESS_TOKEN = originalAccessToken;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function createSignature(secret: string, requestId: string, dataId: string, timestamp: string): string {
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const hash = createHmac("sha256", secret).update(manifest).digest("hex");
    return `ts=${timestamp},v1=${hash}`;
  }

  it("accepts a valid Mercado Pago HMAC signature", () => {
    const secret = "webhook-test-secret";
    const requestId = "request-123";
    const dataId = "MP-123";
    const timestamp = "1793986501";
    env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

    expect(provider.validateWebhookSignature(
      createSignature(secret, requestId, dataId, timestamp),
      requestId,
      dataId,
    )).toBe(true);
  });

  it("rejects a signature generated with another secret", () => {
    env.MERCADO_PAGO_WEBHOOK_SECRET = "expected-secret";

    expect(provider.validateWebhookSignature(
      createSignature("different-secret", "request-123", "123", "1793986501"),
      "request-123",
      "123",
    )).toBe(false);
  });

  it("rejects a signature when required headers are missing", () => {
    env.MERCADO_PAGO_WEBHOOK_SECRET = "webhook-test-secret";

    expect(provider.validateWebhookSignature(undefined, "request-123", "123")).toBe(false);
    expect(provider.validateWebhookSignature("ts=1,v1=abc", undefined, "123")).toBe(false);
    expect(provider.validateWebhookSignature("ts=1,v1=abc", "request-123", undefined)).toBe(false);
  });

  it("rejects malformed, incomplete, or non-hex signature fields", () => {
    env.MERCADO_PAGO_WEBHOOK_SECRET = "webhook-test-secret";
    const valid = createSignature("webhook-test-secret", "request-123", "123", "1793986501");
    const hash = valid.split("v1=")[1];

    expect(provider.validateWebhookSignature("invalid-signature", "request-123", "123")).toBe(false);
    expect(provider.validateWebhookSignature("ts=1", "request-123", "123")).toBe(false);
    expect(provider.validateWebhookSignature("ts=1,v1=not-hex", "request-123", "123")).toBe(false);
    expect(provider.validateWebhookSignature(
      `ts=1793986501,v1=${hash}Z`,
      "request-123",
      "123",
    )).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    env.MERCADO_PAGO_WEBHOOK_SECRET = "webhook-test-secret";

    expect(provider.validateWebhookSignature(
      "ts=invalid,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "request-123",
      "123",
    )).toBe(false);
  });

  it("creates a subscription using the configured plan amount and idempotency key", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-token";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "preapproval-1", init_point: "https://checkout.example/subscription" }),
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(provider.createSubscription({
      teacherId: "teacher-1",
      email: "teacher@example.com",
      amountCents: 590,
      idempotencyKey: "idempotency-1",
    })).resolves.toMatchObject({ id: "preapproval-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/preapproval",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer platform-token",
          "X-Idempotency-Key": "idempotency-1",
        }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    if (!request) throw new Error("Mercado Pago request was not captured.");
    const body = JSON.parse(String(request.body)) as {
      external_reference: string;
      payer_email: string;
      auto_recurring: { transaction_amount: number; currency_id: string };
    };
    expect(body).toMatchObject({
      external_reference: "teacher-1",
      payer_email: "teacher@example.com",
      auto_recurring: { transaction_amount: 5.9, currency_id: "BRL" },
    });
  });

  it("retrieves a subscription using an encoded provider identifier", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-token";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "preapproval/1", status: "authorized" }),
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(provider.getSubscription("preapproval/1")).resolves.toMatchObject({
      status: "authorized",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/preapproval/preapproval%2F1",
      expect.objectContaining({ headers: { Authorization: "Bearer platform-token" } }),
    );
  });

  it("retrieves an authorized recurring payment", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-token";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "invoice-1", preapproval_id: "preapproval-1" }),
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(provider.getAuthorizedPayment("invoice-1")).resolves.toMatchObject({
      preapproval_id: "preapproval-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/authorized_payments/invoice-1",
      expect.objectContaining({ headers: { Authorization: "Bearer platform-token" } }),
    );
  });

  it("cancels a subscription through the provider API", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-token";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({ ok: true } as Response);
    globalThis.fetch = fetchMock;

    await expect(provider.cancelSubscription("preapproval-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/preapproval/preapproval-1",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ Authorization: "Bearer platform-token" }),
        body: JSON.stringify({ status: "canceled" }),
      }),
    );
  });

  it("rejects provider requests when Mercado Pago integration is disabled", async () => {
    env.MERCADO_PAGO_ENABLED = "false";
    const fetchMock = vi.fn<typeof fetch>();
    globalThis.fetch = fetchMock;

    await expect(provider.getSubscription("preapproval-1")).rejects.toThrow("MERCADO_PAGO_DISABLED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a provider error when subscription creation is rejected", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-token";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "invalid plan",
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(provider.createSubscription({
      teacherId: "teacher-1",
      email: "teacher@example.com",
      amountCents: 590,
      idempotencyKey: "idempotency-2",
    })).rejects.toThrow("MERCADO_PAGO_CREATE_SUBSCRIPTION_FAILED: HTTP 422");
  });

});
