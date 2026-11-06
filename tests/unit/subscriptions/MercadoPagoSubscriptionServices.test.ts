import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTeacherSubscriptionService } from "../../../src/modules/subscriptions/services/CreateTeacherSubscriptionService";
import { CancelTeacherSubscriptionService } from "../../../src/modules/subscriptions/services/CancelTeacherSubscriptionService";
import { ProcessMercadoPagoWebhookService } from "../../../src/modules/subscriptions/services/ProcessMercadoPagoWebhookService";
import type { MercadoPagoProvider } from "../../../src/modules/subscriptions/providers/MercadoPagoProvider";
import type { SubscriptionPaymentRepository } from "../../../src/modules/subscriptions/repositories/SubscriptionPaymentRepository";

describe("Mercado Pago subscription services", () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let provider: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findTeacherEmail: vi.fn().mockResolvedValue("teacher@example.com"),
      findPaidPlan: vi.fn().mockResolvedValue({ id: "plan-1", amount_cents: 590 }),
      createPendingSubscription: vi.fn().mockResolvedValue("local-subscription-1"),
      setProviderSubscriptionId: vi.fn().mockResolvedValue(undefined),
      markSubscriptionCancelled: vi.fn().mockResolvedValue(undefined),
      findCurrentSubscription: vi.fn().mockResolvedValue({
        id: "local-subscription-1",
        provider_subscription_id: "mp-subscription-1",
        status: "ACTIVE",
      }),
      markCurrentSubscriptionCancelled: vi.fn().mockResolvedValue(undefined),
      applyWebhookUpdate: vi.fn().mockResolvedValue(true),
    };
    provider = {
      createSubscription: vi.fn().mockResolvedValue({
        id: "mp-subscription-1",
        init_point: "https://checkout.mercadopago.com/test",
      }),
      getSubscription: vi.fn().mockResolvedValue({ id: "mp-subscription-1", status: "authorized" }),
      cancelSubscription: vi.fn().mockResolvedValue(undefined),
      getAuthorizedPayment: vi.fn().mockResolvedValue({
        id: "invoice-1",
        preapproval_id: "mp-subscription-1",
        summarized: "processed",
        payment: { status: "approved" },
      }),
    };
  });

  it("creates a checkout using the amount stored in the plan", async () => {
    const service = new CreateTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).resolves.toEqual({
      checkoutUrl: "https://checkout.mercadopago.com/test",
      subscriptionId: "local-subscription-1",
    });

    expect(repository.createPendingSubscription).toHaveBeenCalledWith("teacher-1", "plan-1");
    expect(provider.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
      teacherId: "teacher-1",
      email: "teacher@example.com",
      amountCents: 590,
    }));
    expect(repository.setProviderSubscriptionId).toHaveBeenCalledWith("local-subscription-1", "mp-subscription-1");
  });

  it("cancels the local pending record when checkout creation fails", async () => {
    provider.createSubscription.mockRejectedValue(new Error("provider unavailable"));
    const service = new CreateTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).rejects.toThrow("provider unavailable");
    expect(repository.markSubscriptionCancelled).toHaveBeenCalledWith("local-subscription-1");
  });

  it("activates benefits only after fetching the subscription status from Mercado Pago", async () => {
    const service = new ProcessMercadoPagoWebhookService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute({
      eventId: "event-1",
      eventType: "subscription_preapproval",
      dataId: "mp-subscription-1",
      payload: { type: "subscription_preapproval" },
    })).resolves.toBe(true);

    expect(provider.getSubscription).toHaveBeenCalledWith("mp-subscription-1");
    expect(repository.applyWebhookUpdate).toHaveBeenCalledWith(expect.objectContaining({
      providerSubscriptionId: "mp-subscription-1",
      status: "ACTIVE",
    }));
  });

  it("does not expire a subscription when Mercado Pago returns an unknown status", async () => {
    provider.getSubscription.mockResolvedValue({
      id: "mp-subscription-1",
      status: "new_provider_status",
    });
    const service = new ProcessMercadoPagoWebhookService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute({
      eventId: "event-unknown",
      eventType: "subscription_preapproval",
      dataId: "mp-subscription-1",
      payload: { type: "subscription_preapproval" },
    })).resolves.toBe(false);

    expect(repository.applyWebhookUpdate).not.toHaveBeenCalled();
  });

  it("does not update an authorized payment when its subscription status is unknown", async () => {
    provider.getSubscription.mockResolvedValue({
      id: "mp-subscription-1",
      status: "new_provider_status",
    });
    const service = new ProcessMercadoPagoWebhookService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute({
      eventId: "event-unknown-payment",
      eventType: "subscription_authorized_payment",
      dataId: "invoice-1",
      payload: { type: "subscription_authorized_payment" },
    })).resolves.toBe(false);

    expect(repository.applyWebhookUpdate).not.toHaveBeenCalled();
  });

  it("marks a rejected recurring payment as past due", async () => {
    provider.getAuthorizedPayment.mockResolvedValue({
      id: "invoice-1",
      preapproval_id: "mp-subscription-1",
      summarized: "recycling",
      payment: { status: "rejected" },
    });
    const service = new ProcessMercadoPagoWebhookService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await service.execute({
      eventId: "event-2",
      eventType: "subscription_authorized_payment",
      dataId: "invoice-1",
      payload: { type: "subscription_authorized_payment" },
    });

    expect(provider.getAuthorizedPayment).toHaveBeenCalledWith("invoice-1");
    expect(repository.applyWebhookUpdate).toHaveBeenCalledWith(expect.objectContaining({
      providerSubscriptionId: "mp-subscription-1",
      status: "PAST_DUE",
    }));
  });

  it("keeps a cancelled subscription cancelled when its last payment was rejected", async () => {
    provider.getAuthorizedPayment.mockResolvedValue({
      id: "invoice-1",
      preapproval_id: "mp-subscription-1",
      summarized: "recycling",
      payment: { status: "rejected" },
    });
    provider.getSubscription.mockResolvedValue({
      id: "mp-subscription-1",
      status: "cancelled",
    });
    const service = new ProcessMercadoPagoWebhookService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await service.execute({
      eventId: "event-3",
      eventType: "subscription_authorized_payment",
      dataId: "invoice-1",
      payload: { type: "subscription_authorized_payment" },
    });

    expect(repository.applyWebhookUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "CANCELLED",
    }));
  });

  it("cancels the provider subscription before updating the local record", async () => {
    const service = new CancelTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).resolves.toBeUndefined();

    expect(repository.findCurrentSubscription).toHaveBeenCalledWith("teacher-1");
    expect(provider.cancelSubscription).toHaveBeenCalledWith("mp-subscription-1");
    expect(repository.markCurrentSubscriptionCancelled).toHaveBeenCalledWith("local-subscription-1");
  });
});
