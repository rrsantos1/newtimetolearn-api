import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../../src/shared/database/data-source";
import { EmailService } from "../../src/shared/email/EmailService";
import { EmailVerificationToken } from "../../src/modules/users/entities/EmailVerificationToken";
import { User } from "../../src/modules/users/entities/User";
import { UserStatus } from "../../src/modules/users/types/UserStatus";
import { ResendVerificationRepository } from "../../src/modules/auth/repositories/implementations/ResendVerificationRepository";
import { ResendVerificationService } from "../../src/modules/auth/services/ResendVerificationService";
import { EmailVerificationTokenService } from "../../src/modules/auth/services/EmailVerificationTokenService";

const sendEmail = vi.spyOn(
  EmailService.prototype,
  "sendVerificationEmail",
);

function makeService(): ResendVerificationService {
  return new ResendVerificationService(
    new ResendVerificationRepository(),
    new EmailService(),
    new EmailVerificationTokenService(),
    vi.fn(),
  );
}

async function createPendingUser(email: string): Promise<User> {
  const repository = AppDataSource.getRepository(User);

  return repository.save(
    repository.create({
      name: "Usuário de Teste",
      email,
      passwordHash: "hash-de-teste",
      status: UserStatus.PENDING_VERIFICATION,
      emailVerifiedAt: null,
    }),
  );
}

async function createOldToken(userId: string): Promise<EmailVerificationToken> {
  const repository = AppDataSource.getRepository(EmailVerificationToken);

  const token = await repository.save(
    repository.create({
      userId,
      tokenHash: new EmailVerificationTokenService().hash(
        `${userId}-token-antigo`,
      ),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      consumedAt: null,
    }),
  );

  await AppDataSource.query(
    `UPDATE email_verification_tokens
     SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes'
     WHERE id = $1`,
    [token.id],
  );

  return token;
}

describe("ResendVerificationService — integração PostgreSQL", () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });

  afterEach(async () => {
    sendEmail.mockReset();
    await AppDataSource.query(
      "TRUNCATE TABLE email_verification_tokens, user_roles, users CASCADE",
    );
  });

  afterAll(async () => {
    vi.restoreAllMocks();

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("consome o token anterior após o envio bem-sucedido", async () => {
    sendEmail.mockResolvedValue(undefined);

    const user = await createPendingUser("sucesso@example.com");
    const oldToken = await createOldToken(user.id);

    await makeService().execute(user.email);

    const tokens = await AppDataSource.getRepository(
      EmailVerificationToken,
    ).find({
      where: { userId: user.id },
      order: { createdAt: "ASC" },
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(tokens).toHaveLength(2);
    expect(tokens.find((token) => token.id === oldToken.id)?.consumedAt)
      .not.toBeNull();
    expect(tokens.filter((token) => token.consumedAt === null)).toHaveLength(1);
  });

  it("preserva o token anterior quando o envio falha", async () => {
    sendEmail.mockRejectedValue(new Error("Falha simulada do Resend"));

    const user = await createPendingUser("falha@example.com");
    const oldToken = await createOldToken(user.id);

    await makeService().execute(user.email);

    const tokens = await AppDataSource.getRepository(
      EmailVerificationToken,
    ).find({
      where: { userId: user.id },
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.id).toBe(oldToken.id);
    expect(tokens[0]?.consumedAt).toBeNull();
  });

  it("respeita o intervalo mínimo entre reenvios", async () => {
    sendEmail.mockResolvedValue(undefined);

    const user = await createPendingUser("cooldown@example.com");
    const service = makeService();

    await service.execute(user.email);
    await service.execute(user.email);

    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("permite apenas um envio em solicitações simultâneas", async () => {
    sendEmail.mockResolvedValue(undefined);

    const user = await createPendingUser("concorrencia@example.com");
    const service = makeService();

    await Promise.all([
      service.execute(user.email),
      service.execute(user.email),
    ]);

    expect(sendEmail).toHaveBeenCalledOnce();

    const tokens = await AppDataSource.getRepository(
      EmailVerificationToken,
    ).find({
      where: { userId: user.id },
    });

    expect(tokens).toHaveLength(1);
    expect(tokens.filter((token) => token.consumedAt === null)).toHaveLength(1);
  });
});