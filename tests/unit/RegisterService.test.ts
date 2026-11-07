import bcrypt from "bcryptjs";
import type { EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../src/modules/auth/errors/AuthError";
import type { IRegisterRepository } from "../../src/modules/auth/repositories/interfaces/IRegisterRepository";
import { RegisterService } from "../../src/modules/auth/services/RegisterService";
import { EmailVerificationTokenService } from "../../src/modules/auth/services/EmailVerificationTokenService";
import { RoleCode } from "../../src/modules/users/types/RoleCode";
import { UserStatus } from "../../src/modules/users/types/UserStatus";
import type { EmailService } from "../../src/shared/email/EmailService";

const transaction = vi.hoisted(() => vi.fn());

vi.mock("../../src/shared/database/data-source", () => ({
  AppDataSource: { transaction },
}));

describe("RegisterService", () => {
  let repository: {
    findUserByEmail: ReturnType<typeof vi.fn>;
    findRoleByCode: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    assignRole: ReturnType<typeof vi.fn>;
    createVerificationToken: ReturnType<typeof vi.fn>;
  };
  let sendVerificationEmail: ReturnType<typeof vi.fn>;
  let service: RegisterService;

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (
      callback: (manager: EntityManager) => Promise<unknown>,
    ) => callback({} as EntityManager));

    repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      findRoleByCode: vi.fn().mockResolvedValue({ id: "role-student", code: RoleCode.STUDENT }),
      createUser: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Aluno Teste",
        email: "aluno@example.com",
      }),
      assignRole: vi.fn().mockResolvedValue(undefined),
      createVerificationToken: vi.fn().mockResolvedValue({ id: "token-1" }),
    };
    sendVerificationEmail = vi.fn().mockResolvedValue(undefined);
    service = new RegisterService(
      repository as unknown as IRegisterRepository,
      { sendVerificationEmail } as unknown as EmailService,
      new EmailVerificationTokenService(),
    );
  });

  const input = {
    name: "Aluno Teste",
    email: "aluno@example.com",
    password: "SenhaSegura123!",
    role: RoleCode.STUDENT,
  };

  it("creates a pending account, assigns its role and sends a verification token", async () => {
    await expect(service.execute(input)).resolves.toEqual({
      message: "Cadastro realizado. Confira seu e-mail para ativar a conta.",
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(repository.findUserByEmail).toHaveBeenCalledWith(expect.anything(), input.email);
    expect(repository.findRoleByCode).toHaveBeenCalledWith(expect.anything(), RoleCode.STUDENT);
    expect(repository.createUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      name: input.name,
      email: input.email,
      status: UserStatus.PENDING_VERIFICATION,
      emailVerifiedAt: null,
    }));

    const createdUser = repository.createUser.mock.calls[0]?.[1] as { passwordHash: string };
    await expect(bcrypt.compare(input.password, createdUser.passwordHash)).resolves.toBe(true);

    expect(repository.assignRole).toHaveBeenCalledWith(expect.anything(), "user-1", "role-student");
    expect(repository.createVerificationToken).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: "user-1",
      consumedAt: null,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    }));
    expect(sendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: "aluno@example.com",
      name: "Aluno Teste",
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("does not create the user when the requested role does not exist", async () => {
    repository.findRoleByCode.mockResolvedValue(null);

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ROLE_NOT_FOUND",
      statusCode: 500,
    });

    expect(repository.createUser).not.toHaveBeenCalled();
    expect(repository.assignRole).not.toHaveBeenCalled();
    expect(repository.createVerificationToken).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("maps the unique email constraint to a conflict error", async () => {
    const duplicateEmailError = Object.assign(new Error("duplicate email"), {
      driverError: { code: "23505", constraint: "uq_users_email" },
    });
    transaction.mockRejectedValueOnce(duplicateEmailError);

    await expect(service.execute(input)).rejects.toBeInstanceOf(AuthError);
    await expect(service.execute(input)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_REGISTERED",
      statusCode: 409,
    });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("reports email delivery failure after the account transaction has completed", async () => {
    sendVerificationEmail.mockRejectedValueOnce(new Error("mail provider unavailable"));

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "VERIFICATION_EMAIL_FAILED",
      statusCode: 503,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(repository.createUser).toHaveBeenCalledOnce();
    expect(repository.createVerificationToken).toHaveBeenCalledOnce();
  });
});
