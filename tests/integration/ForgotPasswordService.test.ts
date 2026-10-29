import bcrypt from "bcryptjs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { AppDataSource } from "../../src/shared/database/data-source";
import { EmailService } from "../../src/shared/email/EmailService";
import { User } from "../../src/modules/users/entities/User";
import { UserStatus } from "../../src/modules/users/types/UserStatus";
import { PasswordResetToken } from "../../src/modules/auth/entities/PasswordResetToken";
import { ForgotPasswordRepository } from "../../src/modules/auth/repositories/implementations/ForgotPasswordRepository";
import { ForgotPasswordService } from "../../src/modules/auth/services/ForgotPasswordService";
import { PasswordResetTokenService } from "../../src/modules/auth/services/PasswordResetTokenService";

describe("ForgotPasswordService - integração", () => {
  const tokenService = new PasswordResetTokenService();

  let emailService: EmailService;
  let sendPasswordResetEmail: MockInstance<
    EmailService["sendPasswordResetEmail"]
  >;
  let onEmailError: (error: unknown) => void;
  let service: ForgotPasswordService;

  async function createUser(
    status: UserStatus = UserStatus.ACTIVE,
  ): Promise<User> {
    return AppDataSource.getRepository(User).save(
      AppDataSource.getRepository(User).create({
        name: "Usuário de Teste",
        email: "forgot-password@example.com",
        passwordHash: await bcrypt.hash("SenhaAntiga123!", 4),
        status,
        emailVerifiedAt:
          status === UserStatus.ACTIVE ? new Date() : null,
      }),
    );
  }

  async function createPreviousToken(userId: string): Promise<PasswordResetToken> {
    const generated = tokenService.generate();

    return AppDataSource.getRepository(PasswordResetToken).save(
      AppDataSource.getRepository(PasswordResetToken).create({
        userId,
        tokenHash: generated.tokenHash,
        expiresAt: generated.expiresAt,
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

    emailService = new EmailService();

    sendPasswordResetEmail = vi
      .spyOn(emailService, "sendPasswordResetEmail")
      .mockResolvedValue(undefined);

    onEmailError = vi.fn<(error: unknown) => void>();

    service = new ForgotPasswordService(
      new ForgotPasswordRepository(),
      emailService,
      tokenService,
      onEmailError,
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();

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

  it("deve criar um token e solicitar o envio do e-mail", async () => {
    const user = await createUser();

    await service.execute(user.email);

    expect(sendPasswordResetEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        email: user.email,
        name: user.name,
        token: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );

    const tokens = await AppDataSource.getRepository(
      PasswordResetToken,
    ).find({
      where: { userId: user.id },
    });

    expect(tokens).toHaveLength(1);
    expect(tokens[0].consumedAt).toBeNull();

    const sentToken = sendPasswordResetEmail.mock.calls[0][0].token;

    expect(tokens[0].tokenHash).toBe(tokenService.hash(sentToken));
  });

  it("não deve revelar se o e-mail não está cadastrado", async () => {
    await expect(
      service.execute("inexistente@example.com"),
    ).resolves.toBeUndefined();

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    const tokenCount = await AppDataSource.getRepository(
      PasswordResetToken,
    ).count();

    expect(tokenCount).toBe(0);
  });

  it.each([
    ["pendente de verificação", UserStatus.PENDING_VERIFICATION],
    ["bloqueada", UserStatus.BLOCKED],
  ])("não deve enviar e-mail para uma conta %s", async (_, status) => {
    await createUser(status);

    await service.execute("forgot-password@example.com");

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    const tokenCount = await AppDataSource.getRepository(
      PasswordResetToken,
    ).count();

    expect(tokenCount).toBe(0);
  });

  it("deve preservar tokens anteriores quando o envio falha", async () => {
    const user = await createUser();
    const previousToken = await createPreviousToken(user.id);

    sendPasswordResetEmail.mockRejectedValueOnce(
      new Error("Falha simulada no envio"),
    );

    await expect(service.execute(user.email)).resolves.toBeUndefined();

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(onEmailError).toHaveBeenCalledOnce();

    const tokens = await AppDataSource.getRepository(
      PasswordResetToken,
    ).find({
      where: { userId: user.id },
    });

    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(previousToken.id);
    expect(tokens[0].consumedAt).toBeNull();
  });

  it("deve invalidar tokens anteriores após o envio bem-sucedido", async () => {
    const user = await createUser();
    const previousToken = await createPreviousToken(user.id);

    await service.execute(user.email);

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(onEmailError).not.toHaveBeenCalled();

    const tokens = await AppDataSource.getRepository(
      PasswordResetToken,
    ).find({
      where: { userId: user.id },
      order: { createdAt: "ASC" },
    });

    expect(tokens).toHaveLength(2);
    expect(tokens.find((token) => token.id === previousToken.id)?.consumedAt)
      .not.toBeNull();

    const newToken = tokens.find((token) => token.id !== previousToken.id);

    expect(newToken).toBeDefined();
    expect(newToken?.consumedAt).toBeNull();
  });
});