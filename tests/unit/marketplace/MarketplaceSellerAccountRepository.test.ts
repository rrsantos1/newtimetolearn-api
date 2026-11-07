import { describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("../../../src/shared/database/data-source", () => ({
  AppDataSource: { query: (...args: unknown[]) => query(...args) },
}));

import { MarketplaceSellerAccountRepository } from "../../../src/modules/marketplace/MarketplaceSellerAccountRepository";

describe("MarketplaceSellerAccountRepository", () => {
  it("stores only the hash of the OAuth state with its expiration", async () => {
    query.mockResolvedValueOnce([]);

    await new MarketplaceSellerAccountRepository().createState(
      "teacher-1",
      "a".repeat(64),
      new Date("2026-11-07T12:00:00.000Z"),
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO marketplace_oauth_states"),
      ["a".repeat(64), "teacher-1", new Date("2026-11-07T12:00:00.000Z")],
    );
  });

  it("consumes a valid OAuth state atomically and returns its owner", async () => {
    query.mockResolvedValueOnce([{ user_id: "teacher-1" }]);

    await expect(new MarketplaceSellerAccountRepository().consumeState("state-hash"))
      .resolves.toBe("teacher-1");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM marketplace_oauth_states"),
      ["state-hash"],
    );
    expect(query.mock.calls[0]?.[0]).toContain("expires_at>CURRENT_TIMESTAMP");
    expect(query.mock.calls[0]?.[0]).toContain("RETURNING user_id");
  });

  it("rejects expired or previously consumed OAuth states", async () => {
    query.mockResolvedValueOnce([]);

    await expect(new MarketplaceSellerAccountRepository().consumeState("expired-hash"))
      .resolves.toBeNull();
  });

  it("upserts the encrypted seller credentials and token expiration", async () => {
    query.mockResolvedValueOnce([]);

    await new MarketplaceSellerAccountRepository().saveAccount({
      userId: "teacher-1",
      mpUserId: "12345",
      accessTokenEncrypted: "encrypted-access",
      refreshTokenEncrypted: "encrypted-refresh",
      tokenExpiresAt: new Date("2026-11-07T13:00:00.000Z"),
      publicKey: "public-key",
      scope: "offline_access write",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(user_id) DO UPDATE"),
      [
        "teacher-1",
        "12345",
        "encrypted-access",
        "encrypted-refresh",
        new Date("2026-11-07T13:00:00.000Z"),
        "public-key",
        "offline_access write",
      ],
    );
  });
});
