import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { AppDataSource } from "../../src/shared/database/data-source";
import { User } from "../../src/modules/users/entities/User";
import { UserStatus } from "../../src/modules/users/types/UserStatus";
import { EmailChangeRequest } from "../../src/modules/auth/entities/EmailChangeRequest";
import { EmailChangeRepository } from "../../src/modules/auth/repositories/implementations/EmailChangeRepository";
import { ConfirmEmailChangeService } from "../../src/modules/auth/services/ConfirmEmailChangeService";
import { PasswordResetTokenService } from "../../src/modules/auth/services/PasswordResetTokenService";

describe("ConfirmEmailChangeService", () => {
  const repository = new EmailChangeRepository();
  const tokenService = new PasswordResetTokenService();

  const service = new ConfirmEmailChangeService(
    repository,
    tokenService,
  );

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  beforeEach(async () => {
    await AppDataSource.query(`
      TRUNCATE TABLE
        email_change_requests,
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

  async function createUser(
    email: string,
    status: UserStatus = UserStatus.ACTIVE,
  ): Promise<User> {
    const userRepository = AppDataSource.getRepository(User);

    const user = userRepository.create({
      name: "Usuário de teste",
      email,
      passwordHash: await bcrypt.hash("Password123!", 4),
      status,
      emailVerifiedAt: new Date(),
    });

    return userRepository.save(user);
  }

  async function createRequest(
    user: User,
    newEmail: string,
    options?: {
      token?: string;
      expiresAt?: Date;
      consumedAt?: Date | null;
    },
  ): Promise<{ request: EmailChangeRequest; token: string }> {
    const token =
      options?.token ?? randomBytes(32).toString("hex");

    const requestRepository =
      AppDataSource.getRepository(EmailChangeRequest);

    const request = requestRepository.create({
        userId: user.id,
        newEmail,
        tokenHash: tokenService.hash(token),
        expiresAt:
            options?.expiresAt ??
            new Date(Date.now() + 60 * 60 * 1000),
        consumedAt: options?.consumedAt ?? null,
        sentAt: new Date(),
    });

    return {
      request: await requestRepository.save(request),
      token,
    };
  }

  it("altera o e-mail e consome o token quando a confirmação é válida", async () => {
    const user = await createUser("atual@example.com");
    const { request, token } = await createRequest(
      user,
      "novo@example.com",
    );

    const result = await service.execute(user.id, { token });

    expect(result.message).toBe("E-mail alterado com sucesso.");

    const updatedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    const updatedRequest = await AppDataSource
      .getRepository(EmailChangeRequest)
      .findOneByOrFail({ id: request.id });

    expect(updatedUser.email).toBe("novo@example.com");
    expect(updatedRequest.consumedAt).toBeInstanceOf(Date);
  });

  it("rejeita um token inexistente", async () => {
    const user = await createUser("atual@example.com");
    const token = randomBytes(32).toString("hex");

    await expect(
      service.execute(user.id, { token }),
    ).rejects.toMatchObject({
      code: "INVALID_EMAIL_CHANGE_TOKEN",
    });

    const unchangedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    expect(unchangedUser.email).toBe("atual@example.com");
  });

  it("rejeita um token expirado", async () => {
    const user = await createUser("atual@example.com");

    const { request, token } = await createRequest(
      user,
      "novo@example.com",
      {
        expiresAt: new Date(Date.now() - 60_000),
      },
    );

    await expect(
      service.execute(user.id, { token }),
    ).rejects.toMatchObject({
      code: "INVALID_EMAIL_CHANGE_TOKEN",
    });

    const unchangedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    const unchangedRequest = await AppDataSource
      .getRepository(EmailChangeRequest)
      .findOneByOrFail({ id: request.id });

    expect(unchangedUser.email).toBe("atual@example.com");
    expect(unchangedRequest.consumedAt).toBeNull();
  });

  it("rejeita um token que já foi utilizado", async () => {
    const user = await createUser("atual@example.com");

    const { token } = await createRequest(
      user,
      "novo@example.com",
    );

    await service.execute(user.id, { token });

    await expect(
      service.execute(user.id, { token }),
    ).rejects.toMatchObject({
      code: "INVALID_EMAIL_CHANGE_TOKEN",
    });

    const updatedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    expect(updatedUser.email).toBe("novo@example.com");
  });

  it("rejeita a confirmação quando o e-mail já pertence a outro usuário", async () => {
    const user = await createUser("atual@example.com");

    await createRequest(user, "destino@example.com");

    const { request, token } = await createRequest(
      user,
      "ocupado@example.com",
    );

    await createUser("ocupado@example.com");

    await expect(
      service.execute(user.id, { token }),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_IN_USE",
    });

    const unchangedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    const unchangedRequest = await AppDataSource
      .getRepository(EmailChangeRequest)
      .findOneByOrFail({ id: request.id });

    expect(unchangedUser.email).toBe("atual@example.com");
    expect(unchangedRequest.consumedAt).toBeNull();
  });

  it("rejeita a confirmação para um usuário inativo", async () => {
    const user = await createUser(
      "atual@example.com",
      UserStatus.BLOCKED,
    );

    const { request, token } = await createRequest(
      user,
      "novo@example.com",
    );

    await expect(
      service.execute(user.id, { token }),
    ).rejects.toMatchObject({
      code: "USER_NOT_ACTIVE",
    });

    const unchangedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    const unchangedRequest = await AppDataSource
      .getRepository(EmailChangeRequest)
      .findOneByOrFail({ id: request.id });

    expect(unchangedUser.email).toBe("atual@example.com");
    expect(unchangedRequest.consumedAt).toBeNull();
  });

  it("permite apenas uma confirmação bem-sucedida para o mesmo token", async () => {
    const user = await createUser("atual@example.com");

    const { token } = await createRequest(
      user,
      "novo@example.com",
    );

    const results = await Promise.allSettled([
      service.execute(user.id, { token }),
      service.execute(user.id, { token }),
    ]);

    const successfulResults = results.filter(
      (result) => result.status === "fulfilled",
    );

    const failedResults = results.filter(
      (result) => result.status === "rejected",
    );

    expect(successfulResults).toHaveLength(1);
    expect(failedResults).toHaveLength(1);

    const updatedUser = await AppDataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });

    expect(updatedUser.email).toBe("novo@example.com");
  });
  
  it("permite que apenas uma conta confirme o mesmo e-mail simultaneamente", async () => {
    const firstUser = await createUser("primeiro@example.com");
    const secondUser = await createUser("segundo@example.com");

    const destinationEmail = "destino-compartilhado@example.com";

    const firstRequest = await createRequest(
        firstUser,
        destinationEmail,
    );

    const secondRequest = await createRequest(
        secondUser,
        destinationEmail,
    );

    const results = await Promise.allSettled([
        service.execute(firstUser.id, {
        token: firstRequest.token,
        }),
        service.execute(secondUser.id, {
        token: secondRequest.token,
        }),
    ]);

    const successfulResults = results.filter(
        (result) => result.status === "fulfilled",
    );

    const failedResults = results.filter(
        (result) => result.status === "rejected",
    );

    expect(successfulResults).toHaveLength(1);
    expect(failedResults).toHaveLength(1);

    const failedResult = failedResults[0];

    if (failedResult.status !== "rejected") {
        throw new Error("Era esperada uma confirmação rejeitada.");
    }

    expect(failedResult.reason).toMatchObject({
        code: "EMAIL_ALREADY_IN_USE",
    });

    const userRepository = AppDataSource.getRepository(User);
    const requestRepository =
        AppDataSource.getRepository(EmailChangeRequest);

    const updatedUsers = await userRepository.find({
        where: [
        { id: firstUser.id },
        { id: secondUser.id },
        ],
    });

    const usersWithDestinationEmail = updatedUsers.filter(
        (user) => user.email === destinationEmail,
    );

    expect(usersWithDestinationEmail).toHaveLength(1);

    const updatedRequests = await requestRepository.find({
        where: [
        { id: firstRequest.request.id },
        { id: secondRequest.request.id },
        ],
    });

    const consumedRequests = updatedRequests.filter(
        (request) => request.consumedAt !== null,
    );

    expect(consumedRequests).toHaveLength(1);
  });
});