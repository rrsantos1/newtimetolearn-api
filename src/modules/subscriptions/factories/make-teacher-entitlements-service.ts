import { TeacherEntitlementsRepository } from "../repositories/TeacherEntitlementsRepository";
import { TeacherEntitlementsService } from "../services/TeacherEntitlementsService";

export function makeTeacherEntitlementsService(): TeacherEntitlementsService {
  return new TeacherEntitlementsService(new TeacherEntitlementsRepository());
}
