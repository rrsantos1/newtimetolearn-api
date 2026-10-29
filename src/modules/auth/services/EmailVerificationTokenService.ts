import { createHash, randomBytes } from "node:crypto";

const TOKEN_EXPIRATION_HOURS = 24;

export class EmailVerificationTokenService {
  generate(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hash(token);
    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000,
    );

    return { token, tokenHash, expiresAt };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}