import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  managerQuery: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../src/shared/database/data-source", () => ({
  AppDataSource: {
    transaction: mocks.transaction,
  },
}));

import { SubscriptionPaymentRepository } from "../../../src/modules/subscriptions/repositories/SubscriptionPaymentRepository";

describe("SubscriptionPaymentRepository", () => {
  const repository = new SubscriptionPaymentRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (manager: { query: typeof mocks.managerQuery }) => Promise<unknown>) =>
        callback({ query: mocks.managerQuery }),
    );
  });

  it("prevents a new checkout when a past-due subscription already exists", async () => {
    mocks.managerQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "existing-subscription" }]);

    await expect(
      repository.createPendingSubscription("teacher-1", "plan-1"),
    ).rejects.toThrow("SUBSCRIPTION_ALREADY_EXISTS");

    expect(mocks.managerQuery).toHaveBeenCalledTimes(2);
    expect(String(mocks.managerQuery.mock.calls[1]?.[0])).toContain("'PAST_DUE'");
  });

  it("does not apply a webhook event already processed", async () => {
    mocks.managerQuery.mockResolvedValueOnce([]);

    await expect(repository.applyWebhookUpdate({
      eventId: "event-duplicate",
      eventType: "subscription_preapproval",
      payload: { type: "subscription_preapproval" },
      providerSubscriptionId: "mp-subscription-1",
      status: "ACTIVE",
    })).resolves.toBe(false);

    expect(mocks.managerQuery).toHaveBeenCalledTimes(1);
    expect(String(mocks.managerQuery.mock.calls[0]?.[0])).toContain(
      "ON CONFLICT (provider, provider_event_id) DO NOTHING",
    );
  });

  it("applies a new webhook event and marks it as processed", async () => {
    mocks.managerQuery
      .mockResolvedValueOnce([{ id: "event-row" }])
      .mockResolvedValueOnce([{ id: "subscription-row" }])
      .mockResolvedValueOnce([]);

    await expect(repository.applyWebhookUpdate({
      eventId: "event-new",
      eventType: "subscription_preapproval",
      payload: { type: "subscription_preapproval" },
      providerSubscriptionId: "mp-subscription-1",
      status: "ACTIVE",
    })).resolves.toBe(true);

    expect(mocks.managerQuery).toHaveBeenCalledTimes(3);
    expect(String(mocks.managerQuery.mock.calls[2]?.[0])).toContain("processed_at = CURRENT_TIMESTAMP");
  });
});
