import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../src/shared/config/env";
import { MarketplaceService } from "../../../src/modules/marketplace/MarketplaceService";
import { MarketplaceRepository } from "../../../src/modules/marketplace/MarketplaceRepository";
import { BackblazeStorageProvider } from "../../../src/shared/storage/providers/BackblazeStorageProvider";
import { PresentationPreviewGenerator } from "../../../src/modules/marketplace/PresentationPreviewGenerator";
import { TeacherEntitlementsRepository } from "../../../src/modules/subscriptions/repositories/TeacherEntitlementsRepository";
import { MarketplaceSellerAccountService } from "../../../src/modules/marketplace/MarketplaceSellerAccountService";

const originalEnabled = env.MERCADO_PAGO_ENABLED;
const originalToken = env.MERCADO_PAGO_ACCESS_TOKEN;
const originalCommission = env.MARKETPLACE_COMMISSION_PERCENT;
const originalFetch = globalThis.fetch;

afterEach(() => {
  env.MERCADO_PAGO_ENABLED = originalEnabled;
  env.MERCADO_PAGO_ACCESS_TOKEN = originalToken;
  env.MARKETPLACE_COMMISSION_PERCENT = originalCommission;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function makeService(publisherType: "ADMIN" | "TEACHER") {
  const checkoutProduct = vi.fn().mockResolvedValue({
    id: "product-1",
    slug: "material",
    title: "Material de teste",
    price_cents: 10000,
    publisher_type: publisherType,
    seller_user_id: "seller-1",
  });
  const createOrder = vi.fn().mockResolvedValue("order-1");
  const setPreference = vi.fn().mockResolvedValue(undefined);
  const repository = { checkoutProduct, createOrder, setPreference } as unknown as MarketplaceRepository;
  const sellerAccounts = {
    getAccessTokenForTeacher: vi.fn().mockResolvedValue("seller-access-token"),
  } as unknown as MarketplaceSellerAccountService;
  const service = new MarketplaceService(
    repository,
    {} as BackblazeStorageProvider,
    {} as PresentationPreviewGenerator,
    {} as TeacherEntitlementsRepository,
    sellerAccounts,
  );
  return { service, createOrder, sellerAccounts };
}

describe("Marketplace Split Payments", () => {
  it("applies the configured 20 percent fee to teacher sales using the seller OAuth token", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-access-token";
    env.MARKETPLACE_COMMISSION_PERCENT = 20;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "preference-1", init_point: "https://checkout.example/test" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { service, createOrder, sellerAccounts } = makeService("TEACHER");

    await service.checkout("material", null, "buyer@example.com");

    expect(sellerAccounts.getAccessTokenForTeacher).toHaveBeenCalledWith("seller-1");
    expect(createOrder).toHaveBeenCalledWith("product-1", null, "buyer@example.com", 10000, 2000);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { marketplace_fee?: number };
    expect(request.headers).toMatchObject({ Authorization: "Bearer seller-access-token" });
    expect(body.marketplace_fee).toBe(20);
  });

  it("does not apply a marketplace fee to admin sales and uses the platform token", async () => {
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_ACCESS_TOKEN = "platform-access-token";
    env.MARKETPLACE_COMMISSION_PERCENT = 20;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "preference-2", init_point: "https://checkout.example/admin" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { service, createOrder, sellerAccounts } = makeService("ADMIN");

    await service.checkout("material", null, "buyer@example.com");

    expect(sellerAccounts.getAccessTokenForTeacher).not.toHaveBeenCalled();
    expect(createOrder).toHaveBeenCalledWith("product-1", null, "buyer@example.com", 10000, 0);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { marketplace_fee?: number };
    expect(request.headers).toMatchObject({ Authorization: "Bearer platform-access-token" });
    expect(body.marketplace_fee).toBeUndefined();
  });
});
