import { describe, expect, it } from "vitest";
import { EmailVerificationTokenService } from "../../src/modules/auth/services/EmailVerificationTokenService";

describe("EmailVerificationTokenService", () => {
  const service = new EmailVerificationTokenService();

  it("deve gerar um token seguro com hash e expiração", () => {
    const result = service.generate();

    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.tokenHash).not.toBe(result.token);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("deve gerar tokens diferentes em chamadas distintas", () => {
    const first = service.generate();
    const second = service.generate();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it("deve gerar sempre o mesmo hash para o mesmo token", () => {
    const token = "a".repeat(64);

    expect(service.hash(token)).toBe(service.hash(token));
  });
});