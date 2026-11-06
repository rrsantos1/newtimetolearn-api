import { randomUUID } from "node:crypto";
import vision from "@google-cloud/vision";
import { AuthError } from "../../auth/errors/AuthError";
import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import { StorageUsageRepository } from "../../../shared/storage/repositories/StorageUsageRepository";
import type { NotificationService } from "../../notifications/services/NotificationService";
import { NotificationType } from "../../notifications/types/NotificationType";
import type { NotebookEntryKind } from "../entities/NotebookEntry";
import { NotebookRepository } from "../repositories/NotebookRepository";

const attachmentTypes = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["text/csv", "csv"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

const maxDocumentSize = 20 * 1024 * 1024;
const maxVideoSize = 50 * 1024 * 1024;
const riskCategories = ["adult", "violence", "racy"] as const;
type RiskCategory = (typeof riskCategories)[number];
const visionClient = env.GOOGLE_APPLICATION_CREDENTIALS
  ? new vision.ImageAnnotatorClient()
  : null;

async function validateNotebookImage(body: Buffer): Promise<void> {
  if (!visionClient) throw new Error("IMAGE_MODERATION_UNAVAILABLE");
  const [result] = await visionClient.safeSearchDetection({ image: { content: body } });
  const annotation = result.safeSearchAnnotation;
  if (!annotation) throw new Error("IMAGE_MODERATION_UNAVAILABLE");

  const blocked = riskCategories.some((category: RiskCategory) => {
    const likelihood = annotation[category];
    return typeof likelihood === "number" && likelihood >= 4;
  });
  if (blocked) throw new Error("IMAGE_REJECTED_BY_MODERATION");
}

export interface NotebookAttachmentInput {
  fileName: string;
  contentType: string;
  body: Buffer;
}

function hasFileSignature(contentType: string, body: Buffer): boolean {
  if (contentType === "image/jpeg") return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (contentType === "image/png") return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/gif") return body.subarray(0, 6).toString("ascii").startsWith("GIF8");
  if (contentType === "image/webp") return body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
  if (contentType === "application/pdf") return body.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "video/mp4" || contentType === "video/quicktime") return body.subarray(4, 8).toString("ascii") === "ftyp";
  if (contentType === "video/webm") return body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (contentType === "application/msword" || contentType === "application/vnd.ms-excel") {
    return body.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return body.length >= 4 && body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04;
  }
  if (contentType === "text/csv") {
    return body.length > 0 && !body.includes(0);
  }
  return false;
}

function safeFileName(value: string): string {
  return value.replace(/[\/\\\r\n\0]/g, "_").trim().slice(0, 180) || "anexo";
}

export class NotebookService {
  constructor(
    private readonly repository: NotebookRepository,
    private readonly notifications: NotificationService,
    private readonly storageUsageRepository: StorageUsageRepository,
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

  private async notifyFirstEntry(
    relationshipId: string,
    studentId: string,
    dayId: string,
    isFirstEntry: boolean,
  ): Promise<void> {
    if (!isFirstEntry) return;
    try {
      await this.notifications.create({
        recipientId: studentId,
        type: NotificationType.NOTEBOOK_DAY_PUBLISHED,
        title: "Novidade no seu caderno",
        message: "Seu professor adicionou conteúdo ao caderno de hoje.",
        link: "/student/notebook",
        metadata: { relationshipId, dayId },
      });
    } catch {
      // A publicação já foi salva; falhas de notificação não devem revertê-la.
    }
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
    await this.notifyFirstEntry(relationshipId, relationship.studentId, result.day.id, result.isFirstEntry);
    return result;
  }

  async updateEntry(
    relationshipId: string,
    userId: string,
    entryId: string,
    kind: NotebookEntryKind,
    content: Record<string, unknown> | undefined,
    dayDate: string | undefined,
  ) {
    const relationship = await this.getAuthorizedRelationship(relationshipId, userId);
    if (relationship.teacherId !== userId) {
      throw new AuthError("FORBIDDEN", 403, "Somente o professor pode editar o conteúdo do caderno.");
    }
    if (dayDate) {
      const parsedDate = new Date(`${dayDate}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dayDate) {
        throw new Error("INVALID_NOTEBOOK_DAY_DATE");
      }
    }
    return this.repository.updateEntry(relationshipId, entryId, kind, content, dayDate);
  }

  async deleteEntry(relationshipId: string, userId: string, entryId: string): Promise<void> {
    const relationship = await this.getAuthorizedRelationship(relationshipId, userId);
    if (relationship.teacherId !== userId) {
      throw new AuthError("FORBIDDEN", 403, "Somente o professor pode remover conteúdo do caderno.");
    }
    await this.repository.softDeleteEntry(relationshipId, entryId, userId);
  }

  async createAttachment(
    relationshipId: string,
    userId: string,
    input: NotebookAttachmentInput,
  ) {
    const relationship = await this.getAuthorizedRelationship(relationshipId, userId);
    if (relationship.teacherId !== userId) {
      throw new AuthError("FORBIDDEN", 403, "Somente o professor pode anexar arquivos ao caderno.");
    }

    const extension = attachmentTypes.get(input.contentType);
    if (!extension) throw new Error("UNSUPPORTED_NOTEBOOK_ATTACHMENT_TYPE");
    const isVideo = input.contentType.startsWith("video/");
    const isImage = input.contentType.startsWith("image/");
    const maxSize = isVideo ? maxVideoSize : isImage ? 5 * 1024 * 1024 : maxDocumentSize;
    if (input.body.byteLength <= 0 || input.body.byteLength > maxSize) {
      throw new Error("INVALID_NOTEBOOK_ATTACHMENT_SIZE");
    }
    if (!hasFileSignature(input.contentType, input.body)) {
      throw new Error("INVALID_NOTEBOOK_ATTACHMENT_CONTENT");
    }
    if (input.contentType.startsWith("image/")) {
      await validateNotebookImage(input.body);
    }

    const currentUsage = await this.storageUsageRepository.getUsageByTeacherId(relationship.teacherId);
    if (currentUsage + input.body.byteLength > env.TEACHER_STORAGE_LIMIT_BYTES) {
      throw new Error("STORAGE_QUOTA_EXCEEDED");
    }

    const fileName = safeFileName(input.fileName);
    const storageKey = `notebooks/${relationshipId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const bucketName = env.B2_QUARANTINE_BUCKET_NAME;
    if (!bucketName) throw new Error("PRIVATE_STORAGE_NOT_CONFIGURED");

    const storage = makeStorageProvider();
    await storage.uploadObject({
      bucketName,
      storageKey,
      contentType: input.contentType,
      body: input.body,
      cacheControl: "private, max-age=300",
    });

    try {
      const kind = input.contentType.startsWith("image/") ? "IMAGE" : "FILE";
      const result = await this.repository.createEntry(relationshipId, userId, kind, {
        storageKey,
        fileName,
        contentType: input.contentType,
        sizeBytes: input.body.byteLength,
      });
      await this.notifyFirstEntry(relationshipId, relationship.studentId, result.day.id, result.isFirstEntry);
      return result;
    } catch (error: unknown) {
      try {
        await storage.deleteObject(storageKey, bucketName);
      } catch {
        // Preserva o erro original; a limpeza poderá ser feita por rotina de manutenção.
      }
      throw error;
    }
  }

  async getAttachmentDownloadUrl(relationshipId: string, entryId: string, userId: string) {
    await this.getAuthorizedRelationship(relationshipId, userId);
    const entry = await this.repository.findAttachmentEntry(relationshipId, entryId);
    if (!entry) throw new AuthError("NOTEBOOK_ATTACHMENT_NOT_FOUND", 404, "Anexo não encontrado.");

    const storageKey = entry.content.storageKey;
    if (typeof storageKey !== "string") throw new Error("INVALID_NOTEBOOK_ATTACHMENT_METADATA");
    const bucketName = env.B2_QUARANTINE_BUCKET_NAME;
    if (!bucketName) throw new Error("PRIVATE_STORAGE_NOT_CONFIGURED");

    const downloadUrl = await makeStorageProvider().createDownloadUrl(storageKey, bucketName, 3600);
    return { downloadUrl, expiresInSeconds: 3600 };
  }

  async getAttachment(relationshipId: string, entryId: string, userId: string, range?: string) {
    await this.getAuthorizedRelationship(relationshipId, userId);
    const entry = await this.repository.findAttachmentEntry(relationshipId, entryId);
    if (!entry) throw new AuthError("NOTEBOOK_ATTACHMENT_NOT_FOUND", 404, "Anexo não encontrado.");
    const storageKey = entry.content.storageKey;
    const fileName = entry.content.fileName;
    const contentType = entry.content.contentType;
    if (typeof storageKey !== "string" || typeof fileName !== "string" || typeof contentType !== "string") {
      throw new Error("INVALID_NOTEBOOK_ATTACHMENT_METADATA");
    }
    const bucketName = env.B2_QUARANTINE_BUCKET_NAME;
    if (!bucketName) throw new Error("PRIVATE_STORAGE_NOT_CONFIGURED");
    const file = await makeStorageProvider().downloadObject(storageKey, bucketName, range);
    return { ...file, fileName, contentType };
  }

  async reorderEntries(
    relationshipId: string,
    userId: string,
    dayId: string,
    entryIds: string[],
  ): Promise<void> {
    const relationship = await this.getAuthorizedRelationship(relationshipId, userId);
    if (relationship.teacherId !== userId) {
      throw new AuthError("FORBIDDEN", 403, "Somente o professor pode organizar o conteúdo do caderno.");
    }
    await this.repository.reorderEntries(relationshipId, dayId, entryIds);
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
