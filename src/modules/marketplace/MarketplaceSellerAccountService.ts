import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../shared/config/env";
import { AppError } from "../../shared/errors/AppError";
import { MarketplaceSellerAccountRepository } from "./MarketplaceSellerAccountRepository";

interface MercadoPagoOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number | string;
  public_key?: string;
  scope?: string;
}

export class MarketplaceSellerAccountService {
  private readonly repository = new MarketplaceSellerAccountRepository();
  private readonly refreshes = new Map<string, Promise<string>>();

  async createAuthorizationUrl(userId: string): Promise<string> {
    this.ensureConfigured();
    const state = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    await this.repository.createState(userId, stateHash, new Date(Date.now() + 10 * 60 * 1000));

    const url = new URL("https://auth.mercadopago.com/authorization");
    url.searchParams.set("client_id", env.MERCADO_PAGO_CLIENT_ID!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("redirect_uri", env.MERCADO_PAGO_OAUTH_REDIRECT_URI!);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "offline_access write");
    return url.toString();
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    this.ensureConfigured();
    if (!code || code.length > 2048 || !state || state.length > 256) {
      throw new AppError("INVALID_MERCADO_PAGO_OAUTH_CALLBACK", 400, "Retorno de autorização inválido.");
    }
    const stateHash = createHash("sha256").update(state).digest("hex");
    const userId = await this.repository.consumeState(stateHash);
    if (!userId) {
      throw new AppError("MERCADO_PAGO_OAUTH_STATE_EXPIRED", 400, "A autorização expirou. Inicie a conexão novamente.");
    }

    const token = await this.requestToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.MERCADO_PAGO_OAUTH_REDIRECT_URI!,
    });
    await this.repository.saveAccount({
      userId,
      mpUserId: String(token.user_id),
      accessTokenEncrypted: this.encrypt(token.access_token),
      refreshTokenEncrypted: this.encrypt(token.refresh_token),
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      publicKey: token.public_key ?? null,
      scope: token.scope ?? null,
    });
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; mpUserId: string | null }> {
    return this.repository.status(userId);
  }

  async getAccessTokenForTeacher(userId: string): Promise<string> {
    this.ensureConfigured();
    const account = await this.repository.findByUserId(userId);
    if (!account) {
      throw new AppError("MERCADO_PAGO_ACCOUNT_NOT_CONNECTED", 409, "Conecte sua conta do Mercado Pago antes de vender materiais.");
    }
    if (new Date(account.token_expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
      return this.decrypt(account.access_token_encrypted);
    }

    const existing = this.refreshes.get(userId);
    if (existing) return existing;
    const refresh = this.refreshAccount(userId, account.refresh_token_encrypted);
    this.refreshes.set(userId, refresh);
    try {
      return await refresh;
    } finally {
      this.refreshes.delete(userId);
    }
  }

  async getAccessTokenForMercadoPagoUser(mpUserId: string): Promise<string | null> {
    const account = await this.repository.findByMercadoPagoUserId(mpUserId);
    if (!account) return null;
    return this.getAccessTokenForTeacher(account.user_id);
  }

  private async refreshAccount(userId: string, encryptedRefreshToken: string): Promise<string> {
    const token = await this.requestToken({
      grant_type: "refresh_token",
      refresh_token: this.decrypt(encryptedRefreshToken),
    });
    await this.repository.updateTokens({
      userId,
      accessTokenEncrypted: this.encrypt(token.access_token),
      refreshTokenEncrypted: this.encrypt(token.refresh_token),
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    });
    return token.access_token;
  }

  private async requestToken(body: Record<string, string>): Promise<MercadoPagoOAuthToken> {
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        client_id: env.MERCADO_PAGO_CLIENT_ID,
        client_secret: env.MERCADO_PAGO_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`MERCADO_PAGO_OAUTH_FAILED: HTTP ${response.status} - ${errorBody.slice(0, 500)}`);
    }
    const token = await response.json() as MercadoPagoOAuthToken;
    if (!token.access_token || !token.refresh_token || !token.user_id || !token.expires_in) {
      throw new Error("MERCADO_PAGO_OAUTH_INVALID_TOKEN_RESPONSE");
    }
    return token;
  }

  private encrypt(value: string): string {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
  }

  private decrypt(value: string): string {
    const [version, ivValue, tagValue, encryptedValue] = value.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
      throw new Error("INVALID_ENCRYPTED_MERCADO_PAGO_TOKEN");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private encryptionKey(): Buffer {
    const value = env.MERCADO_PAGO_TOKEN_ENCRYPTION_KEY;
    if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
      throw new Error("MERCADO_PAGO_TOKEN_ENCRYPTION_KEY must contain 64 hexadecimal characters.");
    }
    return Buffer.from(value, "hex");
  }

  private ensureConfigured(): void {
    if (
      env.MERCADO_PAGO_ENABLED !== "true" ||
      !env.MERCADO_PAGO_CLIENT_ID ||
      !env.MERCADO_PAGO_CLIENT_SECRET ||
      !env.MERCADO_PAGO_OAUTH_REDIRECT_URI ||
      !env.MERCADO_PAGO_TOKEN_ENCRYPTION_KEY
    ) {
      throw new AppError("MERCADO_PAGO_MARKETPLACE_NOT_CONFIGURED", 503, "A conexão com o Mercado Pago ainda não está configurada.");
    }
    this.encryptionKey();
  }
}
