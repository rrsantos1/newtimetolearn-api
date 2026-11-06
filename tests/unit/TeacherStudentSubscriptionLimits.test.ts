import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailService } from "../../src/shared/email/EmailService";
import type { NotificationService } from "../../src/modules/notifications/services/NotificationService";
import type { TeacherStudentRelationship } from "../../src/modules/teacher-students/entities/TeacherStudentRelationship";
import type { ITeacherStudentRepository } from "../../src/modules/teacher-students/repositories/interfaces/ITeacherStudentRepository";
import type { TeacherEntitlementsService } from "../../src/modules/subscriptions/services/TeacherEntitlementsService";
import { TeacherStudentService } from "../../src/modules/teacher-students/services/TeacherStudentService";

describe("TeacherStudentService subscription limits", () => {
  const teacherId = "teacher-123";
  const studentId = "student-123";
  const invitation = {
    id: "invitation-123",
    status: "PENDING",
    invitedAt: new Date("2026-11-01T12:00:00.000Z"),
  } as unknown as TeacherStudentRelationship;

  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let notifications: { create: ReturnType<typeof vi.fn> };
  let email: { sendTeacherStudentInvitationEmail: ReturnType<typeof vi.fn> };
  let entitlements: { getForTeacher: ReturnType<typeof vi.fn> };
  let service: TeacherStudentService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findUserRoles: vi.fn().mockImplementation(async (userId: string) => (
        userId === teacherId ? ["TEACHER"] : ["STUDENT"]
      )),
      findUserByEmail: vi.fn().mockResolvedValue({
        id: studentId,
        name: "Aluno",
        email: "aluno@example.com",
      }),
      findUserById: vi.fn().mockResolvedValue({
        id: teacherId,
        name: "Professor",
        email: "professor@example.com",
      }),
      findActiveRelationshipForStudent: vi.fn().mockResolvedValue(null),
      findPendingRelationship: vi.fn().mockResolvedValue(null),
      createInvitation: vi.fn().mockResolvedValue(invitation),
    };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    email = { sendTeacherStudentInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    entitlements = { getForTeacher: vi.fn().mockResolvedValue({ studentLimit: 5 }) };

    service = new TeacherStudentService(
      repository as unknown as ITeacherStudentRepository,
      notifications as unknown as NotificationService,
      email as unknown as EmailService,
      vi.fn(),
      entitlements as unknown as TeacherEntitlementsService,
    );
  });

  it("passa o limite de cinco alunos para o repositório transacional", async () => {
    await service.inviteStudent(teacherId, "aluno@example.com");

    expect(entitlements.getForTeacher).toHaveBeenCalledWith(teacherId);
    expect(repository.createInvitation).toHaveBeenCalledWith(teacherId, studentId, 5);
  });

  it("converte a violação da cota em erro de domínio", async () => {
    repository.createInvitation.mockRejectedValue(new Error("STUDENT_LIMIT_REACHED"));

    await expect(service.inviteStudent(teacherId, "aluno@example.com")).rejects.toMatchObject({
      code: "STUDENT_LIMIT_REACHED",
      statusCode: 403,
    });

    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.sendTeacherStudentInvitationEmail).not.toHaveBeenCalled();
  });

  it("não aplica limite de alunos quando o plano é ilimitado", async () => {
    entitlements.getForTeacher.mockResolvedValue({ studentLimit: null });

    await service.inviteStudent(teacherId, "aluno@example.com");

    expect(repository.createInvitation).toHaveBeenCalledWith(teacherId, studentId, null);
  });
});
