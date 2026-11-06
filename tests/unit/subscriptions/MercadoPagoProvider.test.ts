import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../../src/shared/config/env";
import { MercadoPagoProvider } from "../../../src/modules/subscriptions/providers/MercadoPagoProvider";

describe("MercadoPagoProvider webhook signature", () => {
  const originalSecret = env.MERCADO_PAGO_WEBHOOK_SECRET;
  const provider = new MercadoPagoProvider();

  afterEach(() => {
    env.MERCADO_PAGO_WEBHOOK_SECRET = originalSecret;
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
});
