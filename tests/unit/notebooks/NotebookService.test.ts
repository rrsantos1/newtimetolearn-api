import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotebookRepository } from "../../../src/modules/notebooks/repositories/NotebookRepository";
import type { NotificationService } from "../../../src/modules/notifications/services/NotificationService";
import { NotebookService } from "../../../src/modules/notebooks/services/NotebookService";
import type { StorageUsageRepository } from "../../../src/shared/storage/repositories/StorageUsageRepository";

const { safeSearchDetection, uploadObject, deleteObject, downloadObject } = vi.hoisted(() => ({
  safeSearchDetection: vi.fn(),
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
  downloadObject: vi.fn(),
}));

vi.mock("@google-cloud/vision", () => ({
  default: {
    ImageAnnotatorClient: class {
      safeSearchDetection = safeSearchDetection;
    },
  },
}));

vi.mock("../../../src/shared/config/env", () => ({
  env: {
    GOOGLE_APPLICATION_CREDENTIALS: "test-credentials.json",
    B2_QUARANTINE_BUCKET_NAME: "notebook-private-test",
    TEACHER_STORAGE_LIMIT_BYTES: 1024,
  },
}));

vi.mock("../../../src/shared/storage/storageFactory", () => ({
  makeStorageProvider: () => ({
    uploadObject,
    deleteObject,
    downloadObject,
  }),
}));

describe("NotebookService", () => {
  const relationshipId = "relationship-123";
  const teacherId = "teacher-123";
  const studentId = "student-123";
  const outsiderId = "outsider-123";

  let repository: {
    findActiveRelationship: ReturnType<typeof vi.fn>;
    listDays: ReturnType<typeof vi.fn>;
    createEntry: ReturnType<typeof vi.fn>;
    updateEntry: ReturnType<typeof vi.fn>;
    softDeleteEntry: ReturnType<typeof vi.fn>;
    findAttachmentEntry: ReturnType<typeof vi.fn>;
    reorderEntries: ReturnType<typeof vi.fn>;
    listNotes: ReturnType<typeof vi.fn>;
    createNote: ReturnType<typeof vi.fn>;
  };
  let notifications: { create: ReturnType<typeof vi.fn> };
  let storageUsage: { getUsageByTeacherId: ReturnType<typeof vi.fn> };
  let service: NotebookService;

  const relationship = {
    id: relationshipId,
    teacherId,
    studentId,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      findActiveRelationship: vi.fn().mockResolvedValue(relationship),
      listDays: vi.fn().mockResolvedValue([]),
      createEntry: vi.fn().mockResolvedValue({
        entry: { id: "entry-123" },
        day: { id: "day-123" },
        isFirstEntry: true,
      }),
      updateEntry: vi.fn(),
      softDeleteEntry: vi.fn().mockResolvedValue(undefined),
      findAttachmentEntry: vi.fn(),
      reorderEntries: vi.fn().mockResolvedValue(undefined),
      listNotes: vi.fn().mockResolvedValue([]),
      createNote: vi.fn().mockResolvedValue({ id: "note-123" }),
    };

    notifications = {
      create: vi.fn().mockResolvedValue({ id: "notification-123" }),
    };
    storageUsage = {
      getUsageByTeacherId: vi.fn().mockResolvedValue(0),
    };

    uploadObject.mockResolvedValue(undefined);
    deleteObject.mockResolvedValue(undefined);
    downloadObject.mockResolvedValue({ body: Buffer.from("file") });
    safeSearchDetection.mockResolvedValue([{
      safeSearchAnnotation: { adult: 1, violence: 1, racy: 1 },
    }]);

    service = new NotebookService(
      repository as unknown as NotebookRepository,
      notifications as unknown as NotificationService,
      storageUsage as unknown as StorageUsageRepository,
    );
  });

  it("bloqueia anexos quando a cota compartilhada de armazenamento foi atingida", async () => {
    storageUsage.getUsageByTeacherId.mockResolvedValue(1024);

    await expect(service.createAttachment(relationshipId, teacherId, {
      fileName: "material.pdf",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.7 conteúdo"),
    })).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");

    expect(uploadObject).not.toHaveBeenCalled();
    expect(repository.createEntry).not.toHaveBeenCalled();
  });

  it("permite que professor e aluno consultem o caderno do vínculo ativo", async () => {
    await expect(service.getNotebook(relationshipId, teacherId)).resolves.toEqual([]);
    await expect(service.getNotebook(relationshipId, studentId)).resolves.toEqual([]);

    expect(repository.findActiveRelationship).toHaveBeenCalledTimes(2);
    expect(repository.listDays).toHaveBeenCalledWith(relationshipId);
  });

  it("retorna 404 quando o vínculo não existe ou não está ativo", async () => {
    repository.findActiveRelationship.mockResolvedValueOnce(null);

    await expect(service.getNotebook(relationshipId, teacherId)).rejects.toMatchObject({
      code: "NOTEBOOK_NOT_FOUND",
      statusCode: 404,
    });
    expect(repository.listDays).not.toHaveBeenCalled();
  });

  it("impede que usuários externos consultem o caderno", async () => {
    await expect(service.getNotebook(relationshipId, outsiderId)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(repository.listDays).not.toHaveBeenCalled();
  });

  it("permite somente ao professor publicar conteúdo", async () => {
    await expect(
      service.createEntry(relationshipId, studentId, "TEXT", { text: "Conteúdo" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    expect(repository.createEntry).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("notifica o aluno quando a primeira entrada do dia é publicada", async () => {
    await service.createEntry(relationshipId, teacherId, "TEXT", { text: "Aula de hoje" });

    expect(repository.createEntry).toHaveBeenCalledWith(
      relationshipId,
      teacherId,
      "TEXT",
      { text: "Aula de hoje" },
    );
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: studentId,
      type: "NOTEBOOK_DAY_PUBLISHED",
      metadata: { relationshipId, dayId: "day-123" },
    }));
  });

  it("não envia notificação quando o dia já possui outras entradas", async () => {
    repository.createEntry.mockResolvedValueOnce({
      entry: { id: "entry-456" },
      day: { id: "day-123" },
      isFirstEntry: false,
    });

    await service.createEntry(relationshipId, teacherId, "TEXT", { text: "Mais conteúdo" });

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("não desfaz a publicação quando o envio da notificação falha", async () => {
    notifications.create.mockRejectedValueOnce(new Error("Notification unavailable"));

    await expect(
      service.createEntry(relationshipId, teacherId, "TEXT", { text: "Conteúdo publicado" }),
    ).resolves.toMatchObject({ entry: { id: "entry-123" } });

    expect(repository.createEntry).toHaveBeenCalledOnce();
  });

  it("impede que o aluno edite ou remova conteúdo publicado", async () => {
    await expect(
      service.updateEntry(relationshipId, studentId, "entry-123", "TEXT", { text: "Alterado" }, undefined),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    await expect(service.deleteEntry(relationshipId, studentId, "entry-123"))
      .rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    expect(repository.updateEntry).not.toHaveBeenCalled();
    expect(repository.softDeleteEntry).not.toHaveBeenCalled();
  });

  it("rejeita datas inválidas ao editar uma entrada", async () => {
    await expect(
      service.updateEntry(relationshipId, teacherId, "entry-123", "TEXT", undefined, "2026-02-30"),
    ).rejects.toThrow("INVALID_NOTEBOOK_DAY_DATE");

    expect(repository.updateEntry).not.toHaveBeenCalled();
  });

  it("notifica o aluno quando o professor envia uma nota", async () => {
    await service.createNote(relationshipId, teacherId, "Bom trabalho!", null);

    expect(repository.createNote).toHaveBeenCalledWith(
      relationshipId,
      teacherId,
      "Bom trabalho!",
      null,
    );
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: studentId,
      type: "NOTEBOOK_NOTE_REPLY",
      title: "Nova mensagem no caderno",
      link: "/student/notebook",
      metadata: { relationshipId, noteId: "note-123" },
    }));
  });

  it("notifica o professor quando o aluno responde uma nota", async () => {
    await service.createNote(relationshipId, studentId, "Obrigado!", "parent-123");

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: teacherId,
      type: "NOTEBOOK_NOTE_REPLY",
      title: "Nova resposta no caderno",
      link: `/teacher/students/${relationshipId}/notebook`,
      metadata: { relationshipId, noteId: "note-123" },
    }));
  });

  it("salva a nota mesmo quando a notificação falha", async () => {
    notifications.create.mockRejectedValueOnce(new Error("Notification unavailable"));

    await expect(
      service.createNote(relationshipId, studentId, "Mensagem salva", null),
    ).resolves.toEqual({ id: "note-123" });

    expect(repository.createNote).toHaveBeenCalledOnce();
  });
  it("armazena anexo PDF no bucket privado e registra os metadados no caderno", async () => {
    const body = Buffer.from("%PDF-1.7 conteúdo");

    const result = await service.createAttachment(relationshipId, teacherId, {
      fileName: "../material/seguro.pdf",
      contentType: "application/pdf",
      body,
    });

    expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: "notebook-private-test",
      storageKey: expect.stringContaining("notebooks/relationship-123/"),
      contentType: "application/pdf",
      body,
      cacheControl: "private, max-age=300",
    }));
    expect(repository.createEntry).toHaveBeenCalledWith(
      relationshipId,
      teacherId,
      "FILE",
      expect.objectContaining({
        fileName: ".._material_seguro.pdf",
        contentType: "application/pdf",
        sizeBytes: body.byteLength,
        storageKey: expect.stringContaining("notebooks/"),
      }),
    );
    expect(result).toMatchObject({ entry: { id: "entry-123" } });
  });

  it("remove o anexo do armazenamento se não conseguir registrar a entrada", async () => {
    repository.createEntry.mockRejectedValueOnce(new Error("Database unavailable"));
    const body = Buffer.from("%PDF-1.7 conteúdo");

    await expect(service.createAttachment(relationshipId, teacherId, {
      fileName: "material.pdf",
      contentType: "application/pdf",
      body,
    })).rejects.toThrow("Database unavailable");

    expect(uploadObject).toHaveBeenCalledOnce();
    expect(deleteObject).toHaveBeenCalledWith(
      expect.stringMatching(/^notebooks\/relationship-123\//),
      "notebook-private-test",
    );
  });

  it("bloqueia upload de anexo por aluno, tipo não permitido e conteúdo inválido", async () => {
    const body = Buffer.from("%PDF-1.7 conteúdo");

    await expect(service.createAttachment(relationshipId, studentId, {
      fileName: "material.pdf",
      contentType: "application/pdf",
      body,
    })).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    await expect(service.createAttachment(relationshipId, teacherId, {
      fileName: "script.exe",
      contentType: "application/x-msdownload",
      body,
    })).rejects.toThrow("UNSUPPORTED_NOTEBOOK_ATTACHMENT_TYPE");

    await expect(service.createAttachment(relationshipId, teacherId, {
      fileName: "arquivo.pdf",
      contentType: "application/pdf",
      body: Buffer.from("não é PDF"),
    })).rejects.toThrow("INVALID_NOTEBOOK_ATTACHMENT_CONTENT");

    expect(uploadObject).not.toHaveBeenCalled();
    expect(repository.createEntry).not.toHaveBeenCalled();
  });

});
