import { createHash, randomBytes } from "node:crypto";

export class PasswordResetTokenService {
  generate() {
    const token = randomBytes(32).toString("hex");

    return {
      token,
      tokenHash: this.hash(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}