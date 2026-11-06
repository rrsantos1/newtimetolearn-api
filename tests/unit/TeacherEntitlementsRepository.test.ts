import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../src/shared/database/data-source", () => ({
  AppDataSource: { query },
}));

import { TeacherEntitlementsRepository } from "../../src/modules/subscriptions/repositories/TeacherEntitlementsRepository";

describe("TeacherEntitlementsRepository", () => {
  let repository: TeacherEntitlementsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TeacherEntitlementsRepository();
  });

  it("retorna os benefícios do plano gratuito", async () => {
    query.mockResolvedValue([{
      plan_code: "FREE",
      plan_name: "Gratuito",
      storage_limit_bytes: "524288000",
      student_limit: 5,
      removes_ads: false,
      subscription_status: "FREE",
    }]);

    await expect(repository.findByTeacherId("teacher-123")).resolves.toEqual({
      planCode: "FREE",
      planName: "Gratuito",
      storageLimitBytes: 524288000,
      studentLimit: 5,
      removesAds: false,
      subscriptionStatus: "FREE",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("latest_subscription"), ["teacher-123"]);
  });

  it("preserva limite nulo de alunos no plano pago", async () => {
    query.mockResolvedValue([{
      plan_code: "TEACHER_MONTHLY",
      plan_name: "Professor",
      storage_limit_bytes: "5368709120",
      student_limit: null,
      removes_ads: true,
      subscription_status: "ACTIVE",
    }]);

    await expect(repository.findByTeacherId("teacher-123")).resolves.toMatchObject({
      planCode: "TEACHER_MONTHLY",
      storageLimitBytes: 5368709120,
      studentLimit: null,
      removesAds: true,
      subscriptionStatus: "ACTIVE",
    });
  });

  it("falha explicitamente quando o plano gratuito não está cadastrado", async () => {
    query.mockResolvedValue([]);

    await expect(repository.findByTeacherId("teacher-123")).rejects.toThrow(
      "SUBSCRIPTION_FREE_PLAN_NOT_CONFIGURED",
    );
  });

  it("conta alunos ativos e convites pendentes como reservas", async () => {
    query.mockResolvedValue([{ total: "5" }]);

    await expect(repository.countReservedStudents("teacher-123")).resolves.toBe(5);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('ACTIVE', 'PENDING')"),
      ["teacher-123"],
    );
  });
});
