import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";

const mocks = vi.hoisted(() => ({
  getRepository: vi.fn(),
  transaction: vi.fn(),
  query: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../src/shared/database/data-source", () => ({
  AppDataSource: {
    getRepository: mocks.getRepository,
    transaction: mocks.transaction,
  },
}));

import { TeacherStudentRepository } from "../../src/modules/teacher-students/repositories/implementations/TeacherStudentRepository";

describe("TeacherStudentRepository invitation quota", () => {
  let repository: TeacherStudentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRepository.mockReturnValue({});
    mocks.create.mockImplementation((value: unknown) => value);
    mocks.save.mockImplementation(async (value: unknown) => value);
    mocks.query.mockResolvedValueOnce([]);
    mocks.transaction.mockImplementation(
      async (callback: (manager: EntityManager) => Promise<unknown>) => callback({
        query: mocks.query,
        getRepository: () => ({
          create: mocks.create,
          save: mocks.save,
        }),
      } as unknown as EntityManager),
    );
    repository = new TeacherStudentRepository();
  });

  it("bloqueia a linha do professor e conta vínculos ativos e convites pendentes na mesma transação", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 5 }]);

    await expect(repository.createInvitation("teacher-123", "student-123", 5))
      .rejects.toThrow("STUDENT_LIMIT_REACHED");

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      ["teacher-123"],
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("status IN ('ACTIVE', 'PENDING')"),
      ["teacher-123"],
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("cria convite quando ainda há vaga no plano", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 4 }]);

    await expect(repository.createInvitation("teacher-123", "student-123", 5))
      .resolves.toMatchObject({
        teacherId: "teacher-123",
        studentId: "student-123",
        status: "PENDING",
      });

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      teacherId: "teacher-123",
      studentId: "student-123",
      status: "PENDING",
    }));
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("não conta nem bloqueia convites para planos ilimitados", async () => {
    await expect(repository.createInvitation("teacher-123", "student-123", null))
      .resolves.toMatchObject({ status: "PENDING" });

    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      ["teacher-123"],
    );
  });
});
