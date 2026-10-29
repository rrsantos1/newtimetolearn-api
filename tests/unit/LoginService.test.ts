import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { env } from "../../src/shared/config/env";
import { LoginService } from "../../src/modules/auth/services/LoginService";
import type {
  ILoginRepository,
  LoginUserRecord,
} from "../../src/modules/auth/repositories/interfaces/ILoginRepository";
import { RoleCode } from "../../src/modules/users/types/RoleCode";
import { UserStatus } from "../../src/modules/users/types/UserStatus";

describe("LoginService", () => {
  const password = "SenhaSegura123!";
  let user: LoginUserRecord;
  let repository: ILoginRepository;
  let findByEmail: ReturnType<typeof vi.fn<
    (email: string) => Promise<LoginUserRecord | null>
  >>;
  let service: LoginService;

  beforeEach(async () => {
    user = {
      id: "7e12f5b8-02b7-4f52-8f4d-5f0d2c7f2e91",
      name: "Aluno Teste",
      email: "aluno@example.com",
      passwordHash: await bcrypt.hash(password, 4),
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: [RoleCode.STUDENT],
    };

    findByEmail = vi.fn();
    repository = { findByEmail };
    service = new LoginService(
        repository,
        (payload) =>
            jwt.sign(payload, env.JWT_SECRET, {
            expiresIn: 3600,
            issuer: "timetolearn-api",
            audience: "timetolearn-app",
            }),
        "1h",
    );
  });

  it("deve autenticar e retornar um JWT válido", async () => {
    findByEmail.mockResolvedValue(user);

    const result = await service.execute({
      email: user.email,
      password,
    });

    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(result.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: [RoleCode.STUDENT],
    });
    expect(result).not.toHaveProperty("passwordHash");

    const payload = jwt.verify(result.accessToken, env.JWT_SECRET, {
      issuer: "timetolearn-api",
      audience: "timetolearn-app",
    });

    expect(payload).toMatchObject({
      sub: user.id,
      roles: [RoleCode.STUDENT],
    });
  });

  it("deve rejeitar um usuário inexistente", async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      service.execute({
        email: "inexistente@example.com",
        password,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    });
  });

  it("deve rejeitar uma senha incorreta", async () => {
    findByEmail.mockResolvedValue(user);

    await expect(
      service.execute({
        email: user.email,
        password: "SenhaIncorreta123!",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    });
  });

  it("deve rejeitar uma conta com e-mail não verificado", async () => {
    findByEmail.mockResolvedValue({
      ...user,
      status: UserStatus.PENDING_VERIFICATION,
    });

    await expect(
      service.execute({
        email: user.email,
        password,
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
      statusCode: 403,
    });
  });

  it("deve rejeitar uma conta bloqueada", async () => {
    findByEmail.mockResolvedValue({
      ...user,
      status: UserStatus.BLOCKED,
    });

    await expect(
      service.execute({
        email: user.email,
        password,
      }),
    ).rejects.toMatchObject({
      code: "ACCOUNT_BLOCKED",
      statusCode: 403,
    });
  });

  it("deve consultar o repositório usando o e-mail recebido", async () => {
    findByEmail.mockResolvedValue(user);

    await service.execute({
      email: user.email,
      password,
    });

    expect(findByEmail).toHaveBeenCalledExactlyOnceWith(user.email);
  });
});