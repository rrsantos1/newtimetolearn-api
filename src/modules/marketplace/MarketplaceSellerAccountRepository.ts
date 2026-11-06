import { AppDataSource } from "../../shared/database/data-source";

interface SellerAccountRow {
  user_id: string;
  mp_user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: Date | string;
  public_key: string | null;
  scope: string | null;
}

export class MarketplaceSellerAccountRepository {
  async createState(userId: string, stateHash: string, expiresAt: Date): Promise<void> {
    await AppDataSource.query(
      "INSERT INTO marketplace_oauth_states(state_hash,user_id,expires_at) VALUES($1,$2,$3)",
      [stateHash, userId, expiresAt],
    );
  }

  async consumeState(stateHash: string): Promise<string | null> {
    const rows = await AppDataSource.query<Array<{ user_id: string }>>(
      "DELETE FROM marketplace_oauth_states WHERE state_hash=$1 AND expires_at>CURRENT_TIMESTAMP RETURNING user_id",
      [stateHash],
    );
    return rows[0]?.user_id ?? null;
  }

  async saveAccount(input: {
    userId: string;
    mpUserId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    tokenExpiresAt: Date;
    publicKey: string | null;
    scope: string | null;
  }): Promise<void> {
    await AppDataSource.query(
      `INSERT INTO marketplace_seller_accounts
        (user_id,mp_user_id,access_token_encrypted,refresh_token_encrypted,token_expires_at,public_key,scope,connected_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
        mp_user_id=EXCLUDED.mp_user_id,
        access_token_encrypted=EXCLUDED.access_token_encrypted,
        refresh_token_encrypted=EXCLUDED.refresh_token_encrypted,
        token_expires_at=EXCLUDED.token_expires_at,
        public_key=EXCLUDED.public_key,
        scope=EXCLUDED.scope,
        connected_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP`,
      [
        input.userId,
        input.mpUserId,
        input.accessTokenEncrypted,
        input.refreshTokenEncrypted,
        input.tokenExpiresAt,
        input.publicKey,
        input.scope,
      ],
    );
  }

  async findByUserId(userId: string): Promise<SellerAccountRow | null> {
    const rows = await AppDataSource.query<SellerAccountRow[]>(
      "SELECT user_id,mp_user_id,access_token_encrypted,refresh_token_encrypted,token_expires_at,public_key,scope FROM marketplace_seller_accounts WHERE user_id=$1",
      [userId],
    );
    return rows[0] ?? null;
  }

  async findByMercadoPagoUserId(mpUserId: string): Promise<SellerAccountRow | null> {
    const rows = await AppDataSource.query<SellerAccountRow[]>(
      "SELECT user_id,mp_user_id,access_token_encrypted,refresh_token_encrypted,token_expires_at,public_key,scope FROM marketplace_seller_accounts WHERE mp_user_id=$1",
      [mpUserId],
    );
    return rows[0] ?? null;
  }

  async updateTokens(input: {
    userId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    await AppDataSource.query(
      "UPDATE marketplace_seller_accounts SET access_token_encrypted=$2,refresh_token_encrypted=$3,token_expires_at=$4,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1",
      [input.userId, input.accessTokenEncrypted, input.refreshTokenEncrypted, input.tokenExpiresAt],
    );
  }

  async status(userId: string): Promise<{ connected: boolean; mpUserId: string | null }> {
    const row = await this.findByUserId(userId);
    return { connected: row !== null, mpUserId: row?.mp_user_id ?? null };
  }
}
