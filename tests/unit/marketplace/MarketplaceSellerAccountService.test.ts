import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../src/shared/config/env";

const repositoryMocks = vi.hoisted(() => ({
  createState: vi.fn(),
  consumeState: vi.fn(),
  saveAccount: vi.fn(),
  status: vi.fn(),
  findByUserId: vi.fn(),
  findByMercadoPagoUserId: vi.fn(),
  updateTokens: vi.fn(),
}));

vi.mock("../../../src/modules/marketplace/MarketplaceSellerAccountRepository", () => ({
  MarketplaceSellerAccountRepository: class {
    createState = repositoryMocks.createState;
    consumeState = repositoryMocks.consumeState;
    saveAccount = repositoryMocks.saveAccount;
    status = repositoryMocks.status;
    findByUserId = repositoryMocks.findByUserId;
    findByMercadoPagoUserId = repositoryMocks.findByMercadoPagoUserId;
    updateTokens = repositoryMocks.updateTokens;
  },
}));

import { MarketplaceSellerAccountService } from "../../../src/modules/marketplace/MarketplaceSellerAccountService";

const originalEnv = {
  enabled: env.MERCADO_PAGO_ENABLED,
  clientId: env.MERCADO_PAGO_CLIENT_ID,
  clientSecret: env.MERCADO_PAGO_CLIENT_SECRET,
  redirectUri: env.MERCADO_PAGO_OAUTH_REDIRECT_URI,
  encryptionKey: env.MERCADO_PAGO_TOKEN_ENCRYPTION_KEY,
};
const originalFetch = globalThis.fetch;

function tokenResponse(accessToken: string, refreshToken: string, userId: number) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    user_id: userId,
    public_key: "public-key",
    scope: "offline_access write",
  };
}

describe("MarketplaceSellerAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.MERCADO_PAGO_ENABLED = "true";
    env.MERCADO_PAGO_CLIENT_ID = "client-id";
    env.MERCADO_PAGO_CLIENT_SECRET = "client-secret";
    env.MERCADO_PAGO_OAUTH_REDIRECT_URI = "https://api.example.com/callback";
    env.MERCADO_PAGO_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    repositoryMocks.createState.mockResolvedValue(undefined);
    repositoryMocks.consumeState.mockResolvedValue("teacher-1");
    repositoryMocks.saveAccount.mockResolvedValue(undefined);
    repositoryMocks.findByUserId.mockResolvedValue(null);
    repositoryMocks.findByMercadoPagoUserId.mockResolvedValue(null);
    repositoryMocks.updateTokens.mockResolvedValue(undefined);
  });

  afterEach(() => {
    env.MERCADO_PAGO_ENABLED = originalEnv.enabled;
    env.MERCADO_PAGO_CLIENT_ID = originalEnv.clientId;
    env.MERCADO_PAGO_CLIENT_SECRET = originalEnv.clientSecret;
    env.MERCADO_PAGO_OAUTH_REDIRECT_URI = originalEnv.redirectUri;
    env.MERCADO_PAGO_TOKEN_ENCRYPTION_KEY = originalEnv.encryptionKey;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("creates an authorization URL with a hashed, expiring state", async () => {
    const service = new MarketplaceSellerAccountService();
    const url = new URL(await service.createAuthorizationUrl("teacher-1"));
    const state = url.searchParams.get("state");

    expect(url.origin + url.pathname).toBe("https://auth.mercadopago.com/authorization");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://api.example.com/callback");
    expect(state).toBeTruthy();
    expect(repositoryMocks.createState).toHaveBeenCalledOnce();
    expect(repositoryMocks.createState.mock.calls[0]?.[0]).toBe("teacher-1");
    const storedStateHash = repositoryMocks.createState.mock.calls[0]?.[1] as string;
    expect(storedStateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedStateHash).not.toBe(state);
    const expiry = repositoryMocks.createState.mock.calls[0]?.[2] as Date;
    expect(expiry.getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000);
  });

  it("exchanges the authorization code and stores encrypted credentials", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => tokenResponse("access-secret", "refresh-secret", 12345),
    } as Response);
    const service = new MarketplaceSellerAccountService();

    await service.completeAuthorization("authorization-code", "oauth-state");

    expect(repositoryMocks.consumeState).toHaveBeenCalledOnce();
    expect(repositoryMocks.saveAccount).toHaveBeenCalledWith(expect.objectContaining({
      userId: "teacher-1",
      mpUserId: "12345",
      publicKey: "public-key",
      scope: "offline_access write",
    }));
    const saved = repositoryMocks.saveAccount.mock.calls[0]?.[0] as {
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string;
    };
    expect(saved.accessTokenEncrypted).not.toBe("access-secret");
    expect(saved.refreshTokenEncrypted).not.toBe("refresh-secret");

    repositoryMocks.findByUserId.mockResolvedValue({
      user_id: "teacher-1",
      mp_user_id: "12345",
      access_token_encrypted: saved.accessTokenEncrypted,
      refresh_token_encrypted: saved.refreshTokenEncrypted,
      token_expires_at: new Date(Date.now() + 60 * 60 * 1000),
      public_key: "public-key",
      scope: "offline_access write",
    });

    await expect(service.getAccessTokenForTeacher("teacher-1")).resolves.toBe("access-secret");
  });

  it("rejects an expired or already consumed OAuth state without calling Mercado Pago", async () => {
    repositoryMocks.consumeState.mockResolvedValue(null);
    const fetchMock = vi.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    const service = new MarketplaceSellerAccountService();

    await expect(service.completeAuthorization("authorization-code", "expired-state"))
      .rejects.toMatchObject({ code: "MERCADO_PAGO_OAUTH_STATE_EXPIRED" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMocks.saveAccount).not.toHaveBeenCalled();
  });

  it("refreshes expired access tokens and persists the rotated credentials", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => tokenResponse("new-access-token", "new-refresh-token", 12345),
    } as Response);
    const service = new MarketplaceSellerAccountService();

    await service.completeAuthorization("authorization-code", "oauth-state");
    const saved = repositoryMocks.saveAccount.mock.calls[0]?.[0] as {
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string;
    };
    repositoryMocks.findByUserId.mockResolvedValue({
      user_id: "teacher-1",
      mp_user_id: "12345",
      access_token_encrypted: saved.accessTokenEncrypted,
      refresh_token_encrypted: saved.refreshTokenEncrypted,
      token_expires_at: new Date(Date.now() - 60_000),
      public_key: null,
      scope: null,
    });

    await expect(service.getAccessTokenForTeacher("teacher-1")).resolves.toBe("new-access-token");
    expect(repositoryMocks.updateTokens).toHaveBeenCalledWith(expect.objectContaining({
      userId: "teacher-1",
      tokenExpiresAt: expect.any(Date),
    }));
    const updated = repositoryMocks.updateTokens.mock.calls[0]?.[0] as {
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string;
    };
    expect(updated.accessTokenEncrypted).not.toBe("new-access-token");
    expect(updated.refreshTokenEncrypted).not.toBe("new-refresh-token");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects checkout access when the teacher has not connected Mercado Pago", async () => {
    const service = new MarketplaceSellerAccountService();

    await expect(service.getAccessTokenForTeacher("teacher-without-account"))
      .rejects.toMatchObject({ code: "MERCADO_PAGO_ACCOUNT_NOT_CONNECTED" });
  });

  it("rejects invalid OAuth callback values before consuming state", async () => {
    const service = new MarketplaceSellerAccountService();

    await expect(service.completeAuthorization("", "state"))
      .rejects.toMatchObject({ code: "INVALID_MERCADO_PAGO_OAUTH_CALLBACK" });

    expect(repositoryMocks.consumeState).not.toHaveBeenCalled();
  });
});
