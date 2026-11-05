import { AuthError } from "../../auth/errors/AuthError";
import type { NotificationService } from "../../notifications/services/NotificationService";
import { NotificationType } from "../../notifications/types/NotificationType";
import type { NotebookEntryKind } from "../entities/NotebookEntry";
import { NotebookRepository } from "../repositories/NotebookRepository";

export class NotebookService {
  constructor(
    private readonly repository: NotebookRepository,
    private readonly notifications: NotificationService,
  ) {}

  private async getAuthorizedRelationship(relationshipId: string, userId: string) {
    const relationship = await this.repository.findActiveRelationship(relationshipId);
    if (!relationship) {
      throw new AuthError("NOTEBOOK_NOT_FOUND", 404, "Caderno não encontrado ou vínculo inativo.");
    }
    if (relationship.teacherId !== userId && relationship.studentId !== userId) {
      throw new AuthError("FORBIDDEN", 403, "Você não tem acesso a este caderno.");
    }
    return relationship;
  }

  async getNotebook(relationshipId: string, userId: string) {
    await this.getAuthorizedRelationship(relationshipId, userId);
    return this.repository.listDays(relationshipId);
  }

  async createEntry(
    relationshipId: string,
    userId: string,
    kind: NotebookEntryKind,
    content: Record<string, unknown>,
  ) {
    const relationship = await this.getAuthorizedRelationship(relationshipId, userId);
    if (relationship.teacherId !== userId) {
      throw new AuthError("FORBIDDEN", 403, "Somente o professor pode publicar conteúdo no caderno.");
    }

    const result = await this.repository.createEntry(relationshipId, userId, kind, content);
    if (result.isFirstEntry) {
      try {
        await this.notifications.create({
          recipientId: relationship.studentId,
          type: NotificationType.NOTEBOOK_DAY_PUBLISHED,
          title: "Novidade no seu caderno",
          message: "Seu professor adicionou conteúdo ao caderno de hoje.",
          link: "/student/notebook",
          metadata: { relationshipId, dayId: result.day.id },
        });
      } catch {
        // A publicação já foi salva; falhas de notificação não devem revertê-la.
      }
    }
    return result;
  }

  async listNotes(relationshipId: string, userId: string) {
    await this.getAuthorizedRelationship(relationshipId, userId);
    return this.repository.listNotes(relationshipId);
  }

  async createNote(
    relationshipId: string,
    userId: string,
    message: string,
    parentId: string | null,
  ) {
    const relationship = await this.getAuthorizedRelationship(relationshipId, userId);
    const note = await this.repository.createNote(relationshipId, userId, message, parentId);
    const recipientId = userId === relationship.teacherId
      ? relationship.studentId
      : relationship.teacherId;
    try {
      await this.notifications.create({
        recipientId,
        type: NotificationType.NOTEBOOK_NOTE_REPLY,
        title: parentId ? "Nova resposta no caderno" : "Nova mensagem no caderno",
        message: "Há uma nova mensagem no bloco de notas compartilhado.",
        link: userId === relationship.teacherId
          ? "/student/notebook"
          : `/teacher/students/${relationshipId}/notebook`,
        metadata: { relationshipId, noteId: note.id },
      });
    } catch {
      // A mensagem já foi salva; falhas de notificação não devem revertê-la.
    }
    return note;
  }
}
