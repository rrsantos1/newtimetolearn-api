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

  it("rejects subscription creation when the teacher does not exist", async () => {
    repository.findTeacherEmail.mockResolvedValue(null);
    const service = new CreateTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("missing-teacher")).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
      statusCode: 404,
    });
    expect(repository.findPaidPlan).not.toHaveBeenCalled();
    expect(repository.createPendingSubscription).not.toHaveBeenCalled();
  });

  it("rejects subscription creation when the paid plan is not configured", async () => {
    repository.findPaidPlan.mockResolvedValue(null);
    const service = new CreateTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).rejects.toThrow("SUBSCRIPTION_PLAN_NOT_CONFIGURED");
    expect(repository.createPendingSubscription).not.toHaveBeenCalled();
    expect(provider.createSubscription).not.toHaveBeenCalled();
  });

  it("cancels the remote subscription when Mercado Pago returns an incomplete checkout", async () => {
    provider.createSubscription.mockResolvedValue({
      id: "remote-subscription-2",
      init_point: "",
    });
    const service = new CreateTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).rejects.toThrow("MERCADO_PAGO_INVALID_CHECKOUT_RESPONSE");
    expect(provider.cancelSubscription).toHaveBeenCalledWith("remote-subscription-2");
    expect(repository.markSubscriptionCancelled).toHaveBeenCalledWith("local-subscription-1");
  });

  it("does not mark a subscription cancelled when the provider refuses cancellation", async () => {
    provider.cancelSubscription.mockRejectedValue(new Error("provider unavailable"));
    const service = new CancelTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).rejects.toThrow("provider unavailable");
    expect(repository.markCurrentSubscriptionCancelled).not.toHaveBeenCalled();
  });

  it("cancels a local pending subscription that has no provider identifier", async () => {
    repository.findCurrentSubscription.mockResolvedValue({
      id: "local-subscription-2",
      provider_subscription_id: null,
      status: "PENDING",
    });
    const service = new CancelTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).resolves.toBeUndefined();
    expect(provider.cancelSubscription).not.toHaveBeenCalled();
    expect(repository.markCurrentSubscriptionCancelled).toHaveBeenCalledWith("local-subscription-2");
  });

  it("returns not found when the teacher has no current subscription to cancel", async () => {
    repository.findCurrentSubscription.mockResolvedValue(null);
    const service = new CancelTeacherSubscriptionService(
      repository as unknown as SubscriptionPaymentRepository,
      provider as unknown as MercadoPagoProvider,
    );

    await expect(service.execute("teacher-1")).rejects.toMatchObject({
      code: "SUBSCRIPTION_NOT_FOUND",
      statusCode: 404,
    });
    expect(provider.cancelSubscription).not.toHaveBeenCalled();
    expect(repository.markCurrentSubscriptionCancelled).not.toHaveBeenCalled();
  });

});
