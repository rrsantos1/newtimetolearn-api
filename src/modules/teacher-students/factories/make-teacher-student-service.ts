import { EmailService } from "../../../shared/email/EmailService";
import { makeNotificationService } from "../../notifications/factories/make-notification-service";
import { TeacherStudentRepository } from "../repositories/implementations/TeacherStudentRepository";
import { TeacherStudentService } from "../services/TeacherStudentService";
import { makeTeacherEntitlementsService } from "../../subscriptions/factories/make-teacher-entitlements-service";

export function makeTeacherStudentService(
  onDeliveryError: (error: unknown, channel: "notification" | "email") => void = () => undefined,
): TeacherStudentService {
  return new TeacherStudentService(
    new TeacherStudentRepository(),
    makeNotificationService(),
    new EmailService(),
    onDeliveryError,
    makeTeacherEntitlementsService(),
  );
}
