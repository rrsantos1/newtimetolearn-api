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
import { EmailChangeRequest } from "../../src/modules/auth/entities/EmailChangeRequest";
import { EmailChangeRepository } from "../../src/modules/auth/repositories/implementations/EmailChangeRepository";
import { RequestEmailChangeService } from "../../src/modules/auth/services/RequestEmailChangeService";
import { PasswordResetTokenService } from "../../src/modules/auth/services/PasswordResetTokenService";
import { AuthError } from "../../src/modules/auth/errors/AuthError";

describe("RequestEmailChangeService - integração", () => {
  const tokenService = new PasswordResetTokenService();

  let emailService: EmailService;
  let sendEmail: MockInstance<EmailService["sendEmailChangeVerification"]>;
  let service: RequestEmailChangeService;

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
  }

  async function createUser(
    email = "email-change@example.com",
    password = "SenhaAtual123!",
  ): Promise<User> {
    const repository = AppDataSource.getRepository(User);

    return repository.save(
      repository.create({
        name: "Usuário de Teste",
        email,
        passwordHash: await bcrypt.hash(password, 4),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      }),
    );
  }

  async function createPreviousRequest(
    userId: string,
  ): Promise<EmailChangeRequest> {
    const generated = tokenService.generate();
    const repository = AppDataSource.getRepository(EmailChangeRequest);

    return repository.save(
      repository.create({
        userId,
        newEmail: "anterior@example.com",
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
    await AppDataSource.query(
      `TRUNCATE TABLE
        email_change_requests,
        password_reset_tokens,
        email_verification_tokens,
        user_roles,
        users
       CASCADE`,
    );

    emailService = new EmailService();

    sendEmail = vi
      .spyOn(emailService, "sendEmailChangeVerification")
      .mockResolvedValue(undefined);

    service = new RequestEmailChangeService(
      new EmailChangeRepository(),
      emailService,
      tokenService,
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    await AppDataSource.query(
      `TRUNCATE TABLE
        email_change_requests,
        password_reset_tokens,
        email_verification_tokens,
        user_roles,
        users
       CASCADE`,
    );
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("cria a solicitação e envia a confirmação sem alterar o e-mail atual", async () => {
    const user = await createUser();

    await expect(
      service.execute(user.id, {
        newEmail: "novo@example.com",
        currentPassword: "SenhaAtual123!",
      }),
    ).resolves.toEqual({
      message:
        "Se a solicitação foi aceita, você receberá um e-mail de confirmação.",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "novo@example.com",
        name: user.name,
        token: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );

    const updatedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });

    expect(updatedUser.email).toBe("email-change@example.com");

    const requests = await AppDataSource
      .getRepository(EmailChangeRequest)
      .findBy({ userId: user.id });

    expect(requests).toHaveLength(1);
    expect(requests[0].newEmail).toBe("novo@example.com");
    expect(requests[0].tokenHash).not.toBe(
      (sendEmail.mock.calls[0][0] as { token: string }).token,
    );
    expect(requests[0].consumedAt).toBeNull();
  });

  it("rejeita uma senha atual incorreta", async () => {
    const user = await createUser();

    await expect(
      service.execute(user.id, {
        newEmail: "novo@example.com",
        currentPassword: "SenhaErrada123!",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_PASSWORD",
    });

    expect(sendEmail).not.toHaveBeenCalled();

    await expect(
      AppDataSource.getRepository(EmailChangeRequest).countBy({
        userId: user.id,
      }),
    ).resolves.toBe(0);
  });

  it("rejeita um e-mail que já pertence a outro usuário", async () => {
    const user = await createUser();

    await createUser("ocupado@example.com");

    await expect(
      service.execute(user.id, {
        newEmail: "ocupado@example.com",
        currentPassword: "SenhaAtual123!",
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_IN_USE",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejeita a alteração para o próprio e-mail", async () => {
    const user = await createUser();

    await expect(
      service.execute(user.id, {
        newEmail: user.email,
        currentPassword: "SenhaAtual123!",
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_UNCHANGED",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("não cria uma solicitação quando o usuário não existe", async () => {
    await expect(
      service.execute("00000000-0000-4000-8000-000000000001", {
        newEmail: "novo@example.com",
        currentPassword: "SenhaAtual123!",
      }),
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("mantém a solicitação anterior válida quando o envio falha", async () => {
    const user = await createUser();
    const previousRequest = await createPreviousRequest(user.id);

    sendEmail.mockRejectedValueOnce(new Error("Falha simulada no envio"));

    await expect(
      service.execute(user.id, {
        newEmail: "novo@example.com",
        currentPassword: "SenhaAtual123!",
      }),
    ).rejects.toBeInstanceOf(AuthError);

    const savedPreviousRequest = await AppDataSource
      .getRepository(EmailChangeRequest)
      .findOneByOrFail({ id: previousRequest.id });

    expect(savedPreviousRequest.consumedAt).toBeNull();

    const updatedUser = await AppDataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });

    expect(updatedUser.email).toBe("email-change@example.com");
  });
  
  it("mantém válida a solicitação mais recente quando os envios terminam em ordem inversa", async () => {
    const user = await createUser();

    const firstSend = deferred<void>();
    const secondSend = deferred<void>();

    sendEmail.mockImplementation(({ email }) => {
        if (email === "primeiro-destino@example.com") {
        return firstSend.promise;
        }

        if (email === "segundo-destino@example.com") {
        return secondSend.promise;
        }

        return Promise.resolve();
    });

    const firstExecution = service.execute(user.id, {
        newEmail: "primeiro-destino@example.com",
        currentPassword: "SenhaAtual123!",
    });

    await vi.waitFor(() => {
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    const secondExecution = service.execute(user.id, {
        newEmail: "segundo-destino@example.com",
        currentPassword: "SenhaAtual123!",
    });

    await vi.waitFor(() => {
        expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    // O segundo e-mail termina primeiro.
    secondSend.resolve(undefined);
    await secondExecution;

    // O primeiro e-mail termina depois.
    firstSend.resolve(undefined);
    await firstExecution;

    const requests = await AppDataSource
        .getRepository(EmailChangeRequest)
        .findBy({ userId: user.id });

    const firstRequest = requests.find(
        (request) => request.newEmail === "primeiro-destino@example.com",
    );

    const secondRequest = requests.find(
        (request) => request.newEmail === "segundo-destino@example.com",
    );

    expect(firstRequest).toBeDefined();
    expect(secondRequest).toBeDefined();

    expect(firstRequest!.sentAt).toBeInstanceOf(Date);
    expect(firstRequest!.consumedAt).toBeInstanceOf(Date);

    expect(secondRequest!.sentAt).toBeInstanceOf(Date);
    expect(secondRequest!.consumedAt).toBeNull();
  });

});