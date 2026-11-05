import { AuthError } from "../../auth/errors/AuthError";
import { EmailService } from "../../../shared/email/EmailService";
import { NotificationService } from "../../notifications/services/NotificationService";
import { NotificationType } from "../../notifications/types/NotificationType";
import type { ITeacherStudentRepository } from "../repositories/interfaces/ITeacherStudentRepository";
import { TeacherStudentStatus } from "../types/TeacherStudentStatus";

export class TeacherStudentService {
  constructor(
    private readonly repository: ITeacherStudentRepository,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly onDeliveryError: (error: unknown, channel: "notification" | "email") => void,
  ) {}

  async searchStudentByEmail(email: string) {
    const student = await this.repository.findUserByEmail(email);
    if (!student) throw new AuthError("STUDENT_NOT_FOUND", 404, "Não encontramos um aluno com esse e-mail.");

    const roles = await this.repository.findUserRoles(student.id);
    if (!roles.includes("STUDENT")) {
      throw new AuthError("USER_IS_NOT_STUDENT", 422, "O usuário informado não possui perfil de aluno.");
    }
    return student;
  }

  async inviteStudent(teacherId: string, email: string) {
    const teacherRoles = await this.repository.findUserRoles(teacherId);
    if (!teacherRoles.includes("TEACHER")) {
      throw new AuthError("FORBIDDEN", 403, "Apenas professores podem enviar convites.");
    }
    const student = await this.searchStudentByEmail(email);
    if (student.id === teacherId) throw new AuthError("INVALID_STUDENT", 422, "Não é possível convidar a própria conta.");

    const active = await this.repository.findActiveRelationshipForStudent(student.id);
    if (active) throw new AuthError("STUDENT_ALREADY_LINKED", 409, "Este aluno já possui um professor vinculado.");

    const pending = await this.repository.findPendingRelationship(teacherId, student.id);
    if (pending) throw new AuthError("INVITATION_ALREADY_PENDING", 409, "Já existe um convite pendente para este aluno.");

    const invitation = await this.repository.createInvitation(teacherId, student.id);
    const teacher = await this.repository.findUserById(teacherId);

    try {
      await this.notificationService.create({
        recipientId: student.id,
        type: NotificationType.TEACHER_STUDENT_INVITATION,
        title: "Novo convite de professor",
        message: `${teacher?.name ?? "Um professor"} enviou um convite para acompanhar seus estudos.`,
        link: "/student/teachers",
        metadata: { relationshipId: invitation.id },
      });
    } catch (error: unknown) {
      this.onDeliveryError(error, "notification");
    }

    if (teacher) {
      try {
        await this.emailService.sendTeacherStudentInvitationEmail({
          email: student.email,
          studentName: student.name,
          teacherName: teacher.name,
        });
      } catch (error: unknown) {
        this.onDeliveryError(error, "email");
      }
    }

    return { id: invitation.id, status: invitation.status, invitedAt: invitation.invitedAt, student };
  }

  async listTeacherRelationships(teacherId: string, status?: TeacherStudentStatus) {
    const roles = await this.repository.findUserRoles(teacherId);
    if (!roles.includes("TEACHER")) throw new AuthError("FORBIDDEN", 403, "Apenas professores podem consultar seus alunos.");
    return this.repository.listForTeacher(teacherId, status);
  }

  async listStudentRelationships(studentId: string) {
    const roles = await this.repository.findUserRoles(studentId);
    if (!roles.includes("STUDENT")) throw new AuthError("FORBIDDEN", 403, "Apenas alunos podem consultar seus convites.");
    return this.repository.listForStudent(studentId);
  }

  async respondToInvitation(studentId: string, relationshipId: string, accept: boolean) {
    const roles = await this.repository.findUserRoles(studentId);
    if (!roles.includes("STUDENT")) throw new AuthError("FORBIDDEN", 403, "Apenas alunos podem responder a convites.");

    const invitation = await this.repository.findStudentRelationship(relationshipId, studentId);
    if (!invitation || invitation.status !== TeacherStudentStatus.PENDING) {
      throw new AuthError("INVITATION_NOT_FOUND", 404, "Convite pendente não encontrado.");
    }

    if (accept) {
      try {
        return await this.repository.acceptInvitation(invitation);
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "STUDENT_ALREADY_LINKED") {
          throw new AuthError("STUDENT_ALREADY_LINKED", 409, "Você já possui um professor vinculado.");
        }
        throw error;
      }
    }

    invitation.status = TeacherStudentStatus.REJECTED;
    invitation.respondedAt = new Date();
    return this.repository.save(invitation);
  }

  async cancelInvitation(teacherId: string, relationshipId: string) {
    const roles = await this.repository.findUserRoles(teacherId);
    if (!roles.includes("TEACHER")) throw new AuthError("FORBIDDEN", 403, "Apenas professores podem cancelar convites.");
    const invitation = await this.repository.findTeacherRelationship(relationshipId, teacherId);
    if (!invitation || invitation.status !== TeacherStudentStatus.PENDING) {
      throw new AuthError("INVITATION_NOT_FOUND", 404, "Convite pendente não encontrado.");
    }
    invitation.status = TeacherStudentStatus.CANCELLED;
    invitation.endedAt = new Date();
    return this.repository.save(invitation);
  }

  async withdrawInvitation(studentId: string, relationshipId: string) {
    const roles = await this.repository.findUserRoles(studentId);
    if (!roles.includes("STUDENT")) throw new AuthError("FORBIDDEN", 403, "Apenas alunos podem cancelar convites recebidos.");
    const invitation = await this.repository.findStudentRelationship(relationshipId, studentId);
    if (!invitation || invitation.status !== TeacherStudentStatus.PENDING) {
      throw new AuthError("INVITATION_NOT_FOUND", 404, "Convite pendente não encontrado.");
    }
    invitation.status = TeacherStudentStatus.CANCELLED;
    invitation.endedAt = new Date();
    return this.repository.save(invitation);
  }

  async endRelationship(teacherId: string, relationshipId: string) {
    const roles = await this.repository.findUserRoles(teacherId);
    if (!roles.includes("TEACHER")) throw new AuthError("FORBIDDEN", 403, "Apenas professores podem encerrar vínculos.");
    const relationship = await this.repository.findTeacherRelationship(relationshipId, teacherId);
    if (!relationship || relationship.status !== TeacherStudentStatus.ACTIVE) {
      throw new AuthError("RELATIONSHIP_NOT_FOUND", 404, "Vínculo ativo não encontrado.");
    }
    relationship.status = TeacherStudentStatus.CANCELLED;
    relationship.endedAt = new Date();
    return this.repository.save(relationship);
  }
}
