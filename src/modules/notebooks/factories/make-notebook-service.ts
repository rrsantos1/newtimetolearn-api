import { makeNotificationService } from "../../notifications/factories/make-notification-service";
import { NotebookRepository } from "../repositories/NotebookRepository";
import { NotebookService } from "../services/NotebookService";
import { StorageUsageRepository } from "../../../shared/storage/repositories/StorageUsageRepository";
import { makeTeacherEntitlementsService } from "../../subscriptions/factories/make-teacher-entitlements-service";

export function makeNotebookService(): NotebookService {
  return new NotebookService(new NotebookRepository(), makeNotificationService(), new StorageUsageRepository(), makeTeacherEntitlementsService());
}
