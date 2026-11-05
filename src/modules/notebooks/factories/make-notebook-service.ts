import { makeNotificationService } from "../../notifications/factories/make-notification-service";
import { NotebookRepository } from "../repositories/NotebookRepository";
import { NotebookService } from "../services/NotebookService";

export function makeNotebookService(): NotebookService {
  return new NotebookService(new NotebookRepository(), makeNotificationService());
}
