import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../src/shared/config/env";
import { MarketplaceService } from "../../../src/modules/marketplace/MarketplaceService";
import { MarketplaceRepository } from "../../../src/modules/marketplace/MarketplaceRepository";
import { MarketplaceSellerAccountService } from "../../../src/modules/marketplace/MarketplaceSellerAccountService";
import { BackblazeStorageProvider } from "../../../src/shared/storage/providers/BackblazeStorageProvider";
import { PresentationPreviewGenerator } from "../../../src/modules/marketplace/PresentationPreviewGenerator";
import { TeacherEntitlementsRepository } from "../../../src/modules/subscriptions/repositories/TeacherEntitlementsRepository";

const originalAccessToken = env.MERCADO_PAGO_ACCESS_TOKEN;
const originalFetch = globalThis.fetch;

describe("Marketplace payment confirmation", () => {
  let order: ReturnType<typeof vi.fn>;
  let applyPayment: ReturnType<typeof vi.fn>;
  let getAccessTokenForMercadoPagoUser: ReturnType<typeof vi.fn>;

  function makeService(): MarketplaceService {
    const repository = {
      order,
      applyPayment,
    } as unknown as MarketplaceRepository;
    const sellerAccounts = {
      getAccessTokenForMercadoPagoUser,
    } as unknown as MarketplaceSellerAccountService;

    return new MarketplaceService(
      repository,
      {} as BackblazeStorageProvider,
      {} as PresentationPreviewGenerator,
      {} as TeacherEntitlementsRepository,
      sellerAccounts,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-token";
    order = vi.fn().mockResolvedValue({ id: "order-1", amount_cents: 2500 });
    applyPayment = vi.fn().mockResolvedValue(true);
    getAccessTokenForMercadoPagoUser = vi.fn().mockResolvedValue("seller-token");
  });

  afterEach(() => {
    env.MERCADO_PAGO_ACCESS_TOKEN = originalAccessToken;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("confirms an approved payment only after validating it with Mercado Pago", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 987,
        status: "approved",
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "BRL",
      }),
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(makeService().payment("987", "event-1", { type: "payment" })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/987",
      expect.objectContaining({
        headers: { Authorization: "Bearer platform-token" },
      }),
    );
    expect(order).toHaveBeenCalledWith("order-1");
    expect(applyPayment).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "order-1",
      paymentId: "987",
      eventId: "event-1",
      status: "APPROVED",
      payload: { type: "payment" },
    }));
  });

  it.each([
    ["rejected", "REJECTED"],
    ["cancelled", "CANCELLED"],
    ["refunded", "REFUNDED"],
    ["charged_back", "REFUNDED"],
  ])("maps Mercado Pago status %s to %s", async (providerStatus, expectedStatus) => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-2",
        status: providerStatus,
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "BRL",
      }),
    } as Response);

    await makeService().payment("payment-2", "event-2", { type: "payment" });

    expect(applyPayment).toHaveBeenCalledWith(expect.objectContaining({
      status: expectedStatus,
    }));
  });

  it("ignores payment statuses that are not mapped by the application", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-3",
        status: "in_process",
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "BRL",
      }),
    } as Response);

    await expect(makeService().payment("payment-3", "event-3", {})).resolves.toBe(false);

    expect(order).not.toHaveBeenCalled();
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("rejects a payment whose amount or currency does not match the order", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-4",
        status: "approved",
        external_reference: "order-1",
        transaction_amount: 24.99,
        currency_id: "BRL",
      }),
    } as Response);

    await expect(makeService().payment("payment-4", "event-4", {})).rejects.toThrow("PAYMENT_ORDER_MISMATCH");
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("rejects a payment collected by a different connected seller", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-5",
        status: "approved",
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "BRL",
        collector_id: 456,
      }),
    } as Response);

    await expect(
      makeService().payment("payment-5", "event-5", {}, "123"),
    ).rejects.toThrow("PAYMENT_SELLER_MISMATCH");

    expect(getAccessTokenForMercadoPagoUser).toHaveBeenCalledWith("123");
    expect(order).not.toHaveBeenCalled();
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("uses the connected seller token when the webhook identifies a seller", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-6",
        status: "approved",
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "BRL",
        collector_id: 123,
      }),
    } as Response);

    await makeService().payment("payment-6", "event-6", {}, "123");

    expect(getAccessTokenForMercadoPagoUser).toHaveBeenCalledWith("123");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/payment-6",
      expect.objectContaining({
        headers: { Authorization: "Bearer seller-token" },
      }),
    );
  });

  it("does not apply an event when Mercado Pago cannot confirm the payment", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    await expect(makeService().payment("payment-7", "event-7", {})).rejects.toThrow("PAYMENT_LOOKUP_FAILED");
    expect(order).not.toHaveBeenCalled();
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("returns false when the repository identifies a duplicate event", async () => {
    applyPayment.mockResolvedValueOnce(false);
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-8",
        status: "approved",
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "BRL",
      }),
    } as Response);

    await expect(makeService().payment("payment-8", "duplicate-event", {})).resolves.toBe(false);
    expect(applyPayment).toHaveBeenCalledOnce();
  });

  it("rejects a payment in a currency other than BRL", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "payment-9",
        status: "approved",
        external_reference: "order-1",
        transaction_amount: 25,
        currency_id: "USD",
      }),
    } as Response);

    await expect(makeService().payment("payment-9", "event-9", {})).rejects.toThrow("PAYMENT_ORDER_MISMATCH");
    expect(applyPayment).not.toHaveBeenCalled();
  });

});
