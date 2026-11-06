import {
  TeacherEntitlementsRepository,
  type TeacherEntitlements,
} from "../repositories/TeacherEntitlementsRepository";

export class TeacherEntitlementsService {
  constructor(private readonly repository: TeacherEntitlementsRepository) {}

  getForTeacher(teacherId: string): Promise<TeacherEntitlements> {
    return this.repository.findByTeacherId(teacherId);
  }

  countReservedStudents(teacherId: string): Promise<number> {
    return this.repository.countReservedStudents(teacherId);
  }
}
