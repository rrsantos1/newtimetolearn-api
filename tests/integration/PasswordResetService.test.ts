import bcrypt from "bcryptjs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { AppDataSource } from "../../src/shared/database/data-source";
import { User } from "../../src/modules/users/entities/User";
import { UserStatus } from "../../src/modules/users/types/UserStatus";
import { PasswordResetToken } from "../../src/modules/auth/entities/PasswordResetToken";
import { AuthError } from "../../src/modules/auth/errors/AuthError";
import { ResetPasswordRepository } from "../../src/modules/auth/repositories/implementations/ResetPasswordRepository";
import { ResetPasswordService } from "../../src/modules/auth/services/ResetPasswordService";
import { PasswordResetTokenService } from "../../src/modules/auth/services/PasswordResetTokenService";

describe("ResetPasswordService - integração", () => {
  const tokenService = new PasswordResetTokenService();

  let user: User;
  let service: ResetPasswordService;

  async function createToken(
    token: string,
    expiresAt: Date,
  ): Promise<PasswordResetToken> {
    return AppDataSource.getRepository(PasswordResetToken).save(
      AppDataSource.getRepository(PasswordResetToken).create({
        userId: user.id,
        tokenHash: tokenService.hash(token),
        expiresAt,
        consumedAt: null,
      }),
    );
  }

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  beforeEach(async () => {
    await AppDataSource.query(`
      TRUNCATE TABLE
        password_reset_tokens,
        email_verification_tokens,
        user_roles,
        users
      CASCADE
    `);

    user = await AppDataSource.getRepository(User).save(
      AppDataSource.getRepository(User).create({
        name: "Usuário de Teste",
        email: "reset-password@example.com",
        passwordHash: await bcrypt.hash("SenhaAntiga123!", 4),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      }),
    );

    service = new ResetPasswordService(
      new ResetPasswordRepository(),
      tokenService,
    );
  });

  afterEach(async () => {
    await AppDataSource.query(`
      TRUNCATE TABLE
        password_reset_tokens,
        email_verification_tokens,
        user_roles,
        users
      CASCADE
    `);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("deve alterar a senha e invalidar todos os tokens do usuário", async () => {
    const validToken = "a".repeat(64);
    const anotherToken = "b".repeat(64);

    await createToken(validToken, new Date(Date.now() + 60_000));
    await createToken(anotherToken, new Date(Date.now() + 60_000));

    await service.execute({
      token: validToken,
      password: "NovaSenhaSegura123!",
    });

    const updatedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });

    expect(
      await bcrypt.compare("NovaSenhaSegura123!", updatedUser.passwordHash),
    ).toBe(true);

    expect(
      await bcrypt.compare("SenhaAntiga123!", updatedUser.passwordHash),
    ).toBe(false);

    const tokens = await AppDataSource.getRepository(PasswordResetToken).find({
      where: { userId: user.id },
    });

    expect(tokens).toHaveLength(2);
    expect(tokens.every((token) => token.consumedAt !== null)).toBe(true);
  });

  it("deve rejeitar um token expirado", async () => {
    const expiredToken = "c".repeat(64);

    await createToken(expiredToken, new Date(Date.now() - 60_000));

    await expect(
      service.execute({
        token: expiredToken,
        password: "NovaSenhaSegura123!",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_RESET_TOKEN",
      statusCode: 400,
    });
  });

  it("deve rejeitar um token já utilizado", async () => {
    const usedToken = "d".repeat(64);

    const token = await createToken(
      usedToken,
      new Date(Date.now() + 60_000),
    );

    token.consumedAt = new Date();

    await AppDataSource.getRepository(PasswordResetToken).save(token);

    await expect(
      service.execute({
        token: usedToken,
        password: "NovaSenhaSegura123!",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_RESET_TOKEN",
      statusCode: 400,
    });
  });

  it("deve permitir apenas uma redefinição em chamadas concorrentes", async () => {
    const token = "e".repeat(64);

    await createToken(token, new Date(Date.now() + 60_000));

    const results = await Promise.allSettled([
      service.execute({
        token,
        password: "NovaSenhaSegura123!",
      }),
      service.execute({
        token,
        password: "OutraSenhaSegura456!",
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1);

    expect(results.filter((result) => result.status === "rejected"))
      .toHaveLength(1);

    const savedTokens = await AppDataSource.getRepository(
      PasswordResetToken,
    ).find({
      where: { userId: user.id },
    });

    expect(savedTokens).toHaveLength(1);
    expect(savedTokens[0].consumedAt).not.toBeNull();
  });

  it("deve rejeitar um token de um usuário bloqueado", async () => {
    const token = "f".repeat(64);

    await createToken(token, new Date(Date.now() + 60_000));

    user.status = UserStatus.BLOCKED;
    await AppDataSource.getRepository(User).save(user);

    await expect(
      service.execute({
        token,
        password: "NovaSenhaSegura123!",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});