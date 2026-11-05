import type { TeacherStudentRelationship } from "../../entities/TeacherStudentRelationship";
import type { TeacherStudentStatus } from "../../types/TeacherStudentStatus";

export interface TeacherStudentUserSummary {
  id: string;
  name: string;
  email: string;
}

export interface TeacherStudentRelationshipRecord {
  id: string;
  status: TeacherStudentStatus;
  invitedAt: Date;
  respondedAt: Date | null;
  endedAt: Date | null;
  teacher: TeacherStudentUserSummary;
  student: TeacherStudentUserSummary;
}

export interface ITeacherStudentRepository {
  findUserByEmail(email: string): Promise<TeacherStudentUserSummary | null>;
  findUserRoles(userId: string): Promise<string[]>;
  findActiveRelationshipForStudent(studentId: string): Promise<TeacherStudentRelationship | null>;
  findPendingRelationship(teacherId: string, studentId: string): Promise<TeacherStudentRelationship | null>;
  createInvitation(teacherId: string, studentId: string): Promise<TeacherStudentRelationship>;
  findTeacherRelationship(relationshipId: string, teacherId: string): Promise<TeacherStudentRelationship | null>;
  findStudentRelationship(relationshipId: string, studentId: string): Promise<TeacherStudentRelationship | null>;
  save(relationship: TeacherStudentRelationship): Promise<TeacherStudentRelationship>;
  listForTeacher(teacherId: string, status?: TeacherStudentStatus): Promise<TeacherStudentRelationshipRecord[]>;
  listForStudent(studentId: string): Promise<TeacherStudentRelationshipRecord[]>;
  hasActiveRelationship(teacherId: string, studentId: string): Promise<boolean>;
}
