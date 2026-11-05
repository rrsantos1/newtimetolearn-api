import { TeacherStudentRepository } from "../repositories/implementations/TeacherStudentRepository";
import { TeacherStudentService } from "../services/TeacherStudentService";

export function makeTeacherStudentService(): TeacherStudentService {
  return new TeacherStudentService(new TeacherStudentRepository());
}
