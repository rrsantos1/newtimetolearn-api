import { AppDataSource } from "../../../../shared/database/data-source";
import { Role } from "../../../users/entities/Role";
import { User } from "../../../users/entities/User";
import { UserRole } from "../../../users/entities/UserRole";
import { TeacherStudentRelationship } from "../../entities/TeacherStudentRelationship";
import type {
  ITeacherStudentRepository,
  TeacherStudentRelationshipRecord,
  TeacherStudentUserSummary,
} from "../interfaces/ITeacherStudentRepository";
import { TeacherStudentStatus } from "../../types/TeacherStudentStatus";

export class TeacherStudentRepository implements ITeacherStudentRepository {
  private readonly relationshipRepository = AppDataSource.getRepository(TeacherStudentRelationship);
  private readonly userRepository = AppDataSource.getRepository(User);

  async findUserByEmail(email: string): Promise<TeacherStudentUserSummary | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  }

  async findUserRoles(userId: string): Promise<string[]> {
    const rows = await AppDataSource.getRepository(UserRole)
      .createQueryBuilder("userRole")
      .innerJoin("userRole.role", "role")
      .select("role.code", "code")
      .where("userRole.user_id = :userId", { userId })
      .getRawMany<{ code: string }>();
    return rows.map((row) => row.code);
  }

  async findActiveRelationshipForStudent(studentId: string): Promise<TeacherStudentRelationship | null> {
    return this.relationshipRepository.findOne({
      where: { studentId, status: TeacherStudentStatus.ACTIVE },
    });
  }

  async findPendingRelationship(teacherId: string, studentId: string): Promise<TeacherStudentRelationship | null> {
    return this.relationshipRepository.findOne({
      where: { teacherId, studentId, status: TeacherStudentStatus.PENDING },
    });
  }

  async createInvitation(teacherId: string, studentId: string): Promise<TeacherStudentRelationship> {
    const invitation = this.relationshipRepository.create({
      teacherId,
      studentId,
      status: TeacherStudentStatus.PENDING,
      invitedAt: new Date(),
      respondedAt: null,
      endedAt: null,
    });
    return this.relationshipRepository.save(invitation);
  }

  async findTeacherRelationship(relationshipId: string, teacherId: string): Promise<TeacherStudentRelationship | null> {
    return this.relationshipRepository.findOne({ where: { id: relationshipId, teacherId } });
  }

  async findStudentRelationship(relationshipId: string, studentId: string): Promise<TeacherStudentRelationship | null> {
    return this.relationshipRepository.findOne({ where: { id: relationshipId, studentId } });
  }

  async save(relationship: TeacherStudentRelationship): Promise<TeacherStudentRelationship> {
    return this.relationshipRepository.save(relationship);
  }

  async acceptInvitation(relationship: TeacherStudentRelationship): Promise<TeacherStudentRelationship> {
    return AppDataSource.transaction(async (manager) => {
      await manager.query(
        "SELECT id FROM users WHERE id = $1 FOR UPDATE",
        [relationship.studentId],
      );

      const active = await manager.getRepository(TeacherStudentRelationship).findOne({
        where: {
          studentId: relationship.studentId,
          status: TeacherStudentStatus.ACTIVE,
        },
      });

      if (active && active.id !== relationship.id) {
        throw new Error("STUDENT_ALREADY_LINKED");
      }

      relationship.status = TeacherStudentStatus.ACTIVE;
      relationship.respondedAt = new Date();
      return manager.getRepository(TeacherStudentRelationship).save(relationship);
    });
  }

  async listForTeacher(teacherId: string, status?: TeacherStudentStatus): Promise<TeacherStudentRelationshipRecord[]> {
    const query = this.relationshipRepository.createQueryBuilder("relationship")
      .innerJoinAndSelect("relationship.teacher", "teacher")
      .innerJoinAndSelect("relationship.student", "student")
      .where("relationship.teacherId = :teacherId", { teacherId })
      .orderBy("relationship.createdAt", "DESC");
    if (status) query.andWhere("relationship.status = :status", { status });
    const rows = await query.getMany();
    return rows.map((item) => ({
      id: item.id,
      status: item.status,
      invitedAt: item.invitedAt,
      respondedAt: item.respondedAt,
      endedAt: item.endedAt,
      teacher: { id: item.teacher.id, name: item.teacher.name, email: item.teacher.email },
      student: { id: item.student.id, name: item.student.name, email: item.student.email },
    }));
  }

  async listForStudent(studentId: string): Promise<TeacherStudentRelationshipRecord[]> {
    const rows = await this.relationshipRepository.createQueryBuilder("relationship")
      .innerJoinAndSelect("relationship.teacher", "teacher")
      .innerJoinAndSelect("relationship.student", "student")
      .where("relationship.studentId = :studentId", { studentId })
      .orderBy("relationship.createdAt", "DESC")
      .getMany();
    return rows.map((item) => ({
      id: item.id,
      status: item.status,
      invitedAt: item.invitedAt,
      respondedAt: item.respondedAt,
      endedAt: item.endedAt,
      teacher: { id: item.teacher.id, name: item.teacher.name, email: item.teacher.email },
      student: { id: item.student.id, name: item.student.name, email: item.student.email },
    }));
  }
}
