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
import { EmailVerificationToken } from "../../src/modules/users/entities/EmailVerificationToken";
import { User } from "../../src/modules/users/entities/User";
import { UserStatus } from "../../src/modules/users/types/UserStatus";
import { EmailVerificationRepository } from "../../src/modules/auth/repositories/implementations/EmailVerificationRepository";
import { VerifyEmailService } from "../../src/modules/auth/services/VerifyEmailService";
import { EmailVerificationTokenService } from "../../src/modules/auth/services/EmailVerificationTokenService";

describe("VerifyEmailService - integração PostgreSQL", () => {
  const tokenService = new EmailVerificationTokenService();
  let user: User;
  let service: VerifyEmailService;

  async function createToken(
    token: string,
    expiresAt: Date,
    consumedAt: Date | null = null,
  ): Promise<EmailVerificationToken> {
    const repository = AppDataSource.getRepository(EmailVerificationToken);
    return repository.save(repository.create({
      userId: user.id,
      tokenHash: tokenService.hash(token),
      expiresAt,
      consumedAt,
    }));
  }

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  beforeEach(async () => {
    await AppDataSource.query(
      "TRUNCATE TABLE email_verification_tokens, user_roles, users CASCADE",
    );

    user = await AppDataSource.getRepository(User).save(
      AppDataSource.getRepository(User).create({
        name: "Usuário de Verificação",
        email: "verify-email@example.com",
        passwordHash: "hash-de-teste",
        status: UserStatus.PENDING_VERIFICATION,
        emailVerifiedAt: null,
      }),
    );

    service = new VerifyEmailService(
      new EmailVerificationRepository(),
      tokenService,
    );
  });

  afterEach(async () => {
    await AppDataSource.query(
      "TRUNCATE TABLE email_verification_tokens, user_roles, users CASCADE",
    );
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("ativa a conta e consome o token após uma confirmação válida", async () => {
    const token = "a".repeat(64);
    await createToken(token, new Date(Date.now() + 60_000));

    await expect(service.execute(token)).resolves.toEqual({
      message: "E-mail confirmado. Sua conta está ativa.",
    });

    const updatedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    const savedTokens = await AppDataSource.getRepository(EmailVerificationToken).findBy({
      userId: user.id,
    });

    expect(updatedUser.status).toBe(UserStatus.ACTIVE);
    expect(updatedUser.emailVerifiedAt).toBeInstanceOf(Date);
    expect(savedTokens).toHaveLength(1);
    expect(savedTokens[0]?.consumedAt).toBeInstanceOf(Date);
  });

  it("rejeita um token inexistente", async () => {
    await expect(service.execute("b".repeat(64))).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
      statusCode: 400,
    });

    const unchangedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    expect(unchangedUser.status).toBe(UserStatus.PENDING_VERIFICATION);
    expect(unchangedUser.emailVerifiedAt).toBeNull();
  });

  it("rejeita um token expirado sem ativar a conta", async () => {
    const token = "c".repeat(64);
    await createToken(token, new Date(Date.now() - 60_000));

    await expect(service.execute(token)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
      statusCode: 400,
    });

    const unchangedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    expect(unchangedUser.status).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it("rejeita um token já consumido", async () => {
    const token = "d".repeat(64);
    await createToken(token, new Date(Date.now() + 60_000), new Date());

    await expect(service.execute(token)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
      statusCode: 400,
    });

    const unchangedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    expect(unchangedUser.status).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it("não ativa uma conta bloqueada mesmo com token válido", async () => {
    const token = "e".repeat(64);
    await createToken(token, new Date(Date.now() + 60_000));

    user.status = UserStatus.BLOCKED;
    await AppDataSource.getRepository(User).save(user);

    await expect(service.execute(token)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_TOKEN",
      statusCode: 400,
    });

    const unchangedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    expect(unchangedUser.status).toBe(UserStatus.BLOCKED);
    expect(unchangedUser.emailVerifiedAt).toBeNull();
  });

  it("permite somente uma confirmação concorrente para o mesmo token", async () => {
    const token = "f".repeat(64);
    await createToken(token, new Date(Date.now() + 60_000));

    const results = await Promise.allSettled([
      service.execute(token),
      service.execute(token),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const updatedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    expect(updatedUser.status).toBe(UserStatus.ACTIVE);
  });
});
