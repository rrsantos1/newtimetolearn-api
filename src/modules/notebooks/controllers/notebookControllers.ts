import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError, z } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeNotebookService } from "../factories/make-notebook-service";

const richDocumentSchema = z.record(z.string(), z.unknown()).refine(
  (document) => (JSON.stringify(document)?.length ?? Number.POSITIVE_INFINITY) <= 20000,
  "O conteúdo formatado excede o limite permitido.",
);

const entrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEXT"),
    content: z.union([
      z.object({ text: z.string().trim().min(1).max(20000) }),
      z.object({ document: richDocumentSchema }),
    ]),
  }),
  z.object({
    kind: z.literal("ACTIVITY_LINK"),
    content: z.object({
      title: z.string().trim().min(1).max(160),
      url: z.string().url().refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }, "O link precisa usar HTTP ou HTTPS."),
    }),
  }),
]);

const updateEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEXT"),
    content: z.union([
      z.object({ text: z.string().trim().min(1).max(20000) }),
      z.object({ document: richDocumentSchema }),
    ]).optional(),
    dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).refine((value) => value.content !== undefined || value.dayDate !== undefined),
  z.object({
    kind: z.literal("ACTIVITY_LINK"),
    content: z.object({
      title: z.string().trim().min(1).max(160),
      url: z.string().url().refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }, "O link precisa usar HTTP ou HTTPS."),
    }).optional(),
    dayDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  }).refine((value) => value.content !== undefined || value.dayDate !== undefined),
  z.object({
    kind: z.literal("IMAGE"),
    dayDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  }).refine((value) => value.dayDate !== undefined),
  z.object({
    kind: z.literal("FILE"),
    dayDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  }).refine((value) => value.dayDate !== undefined),
]);

const reorderSchema = z.object({
  dayId: z.string().uuid(),
  entryIds: z.array(z.string().uuid()).min(1).max(200),
});

const noteSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  parentId: z.string().uuid().nullable().optional(),
});

interface RelationshipParams {
  relationshipId: string;
}

interface EntryParams extends RelationshipParams {\n  entryId: string;\n}\n\ninterface AttachmentParams extends RelationshipParams {
  entryId: string;
}

function decodeFileName(value: string | string[] | undefined): string {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return "anexo";
  try {
    return decodeURIComponent(header).replace(/[\r\n\0]/g, "_").slice(0, 180);
  } catch {
    return "anexo";
  }
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply, message: string) {
  if (error instanceof ZodError) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Os dados enviados são inválidos." }, requestId: request.id });
  }
  if (error instanceof AuthError) {
    return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "NOTEBOOK_ENTRY_NOT_FOUND") {
    return reply.status(404).send({ success: false, error: { code: error.message, message: "Conteúdo não encontrado no caderno." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "NOTEBOOK_ENTRY_KIND_MISMATCH") {
    return reply.status(400).send({ success: false, error: { code: error.message, message: "O tipo de conteúdo não pode ser alterado." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "INVALID_NOTEBOOK_DAY_DATE") {
    return reply.status(400).send({ success: false, error: { code: error.message, message: "A data informada é inválida." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "NOTEBOOK_DAY_NOT_FOUND") {
    return reply.status(404).send({ success: false, error: { code: error.message, message: "Dia do caderno não encontrado." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "IMAGE_REJECTED_BY_MODERATION") {
    return reply.status(422).send({ success: false, error: { code: error.message, message: "A imagem não passou pela validação automática de conteúdo." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "IMAGE_MODERATION_UNAVAILABLE") {
    return reply.status(503).send({ success: false, error: { code: error.message, message: "A validação da imagem está indisponível. Tente novamente mais tarde." }, requestId: request.id });
  }
  if (error instanceof Error && ["UNSUPPORTED_NOTEBOOK_ATTACHMENT_TYPE", "INVALID_NOTEBOOK_ATTACHMENT_SIZE", "INVALID_NOTEBOOK_ATTACHMENT_CONTENT"].includes(error.message)) {
    return reply.status(400).send({ success: false, error: { code: error.message, message: "O arquivo não atende aos formatos, conteúdo ou limites permitidos." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "STORAGE_OBJECT_NOT_FOUND") {
    return reply.status(404).send({ success: false, error: { code: error.message, message: "Arquivo não encontrado no armazenamento." }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "INVALID_NOTEBOOK_ENTRY_ORDER") {
    return reply.status(400).send({ success: false, error: { code: error.message, message: "A ordem dos itens enviada é inválida." }, requestId: request.id });
  }
  request.log.error({ err: error }, message);
  return reply.status(500).send({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Ocorreu um erro interno." }, requestId: request.id });
}

export async function getNotebookController(
  request: FastifyRequest<{ Params: RelationshipParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const data = await makeNotebookService().getNotebook(request.params.relationshipId, request.user.sub);
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao consultar caderno.");
  }
}

export async function createNotebookEntryController(
  request: FastifyRequest<{ Params: RelationshipParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = entrySchema.parse(request.body);
    const data = await makeNotebookService().createEntry(
      request.params.relationshipId,
      request.user.sub,
      input.kind,
      input.content,
    );
    return reply.status(201).send({ success: true, data });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao publicar conteúdo no caderno.");
  }
}

export async function updateNotebookEntryController(
  request: FastifyRequest<{ Params: EntryParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = updateEntrySchema.parse(request.body);
    const data = await makeNotebookService().updateEntry(
      request.params.relationshipId,
      request.user.sub,
      request.params.entryId,
      input.kind,
      "content" in input ? input.content : undefined,
      input.dayDate,
    );
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao atualizar conteúdo do caderno.");
  }
}

export async function deleteNotebookEntryController(
  request: FastifyRequest<{ Params: EntryParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    await makeNotebookService().deleteEntry(
      request.params.relationshipId,
      request.user.sub,
      request.params.entryId,
    );
    return reply.status(200).send({ success: true, message: "Conteúdo removido do caderno." });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao remover conteúdo do caderno.");
  }
}

export async function createNotebookAttachmentController(
  request: FastifyRequest<{ Params: RelationshipParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim();
  const body = Buffer.isBuffer(request.body) ? request.body : null;
  if (!contentType || !body) {
    return reply.status(400).send({ success: false, error: { code: "INVALID_NOTEBOOK_ATTACHMENT", message: "Envie um arquivo válido." }, requestId: request.id });
  }

  try {
    const data = await makeNotebookService().createAttachment(
      request.params.relationshipId,
      request.user.sub,
      { fileName: decodeFileName(request.headers["x-file-name"]), contentType, body },
    );
    return reply.status(201).send({ success: true, data });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao anexar arquivo ao caderno.");
  }
}

export async function getNotebookAttachmentController(
  request: FastifyRequest<{ Params: AttachmentParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const file = await makeNotebookService().getAttachment(
      request.params.relationshipId,
      request.params.entryId,
      request.user.sub,
    );
    const encodedFileName = encodeURIComponent(file.fileName).replace(/[!'()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase());
    return reply
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodedFileName}`)
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .type(file.contentType)
      .send(file.body);
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao baixar anexo do caderno.");
  }
}

export async function reorderNotebookEntriesController(
  request: FastifyRequest<{ Params: RelationshipParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = reorderSchema.parse(request.body);
    await makeNotebookService().reorderEntries(
      request.params.relationshipId,
      request.user.sub,
      input.dayId,
      input.entryIds,
    );
    return reply.status(200).send({ success: true, message: "Itens organizados com sucesso." });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao organizar itens do caderno.");
  }
}

export async function listNotebookNotesController(
  request: FastifyRequest<{ Params: RelationshipParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const data = await makeNotebookService().listNotes(request.params.relationshipId, request.user.sub);
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao consultar bloco de notas.");
  }
}

export async function createNotebookNoteController(
  request: FastifyRequest<{ Params: RelationshipParams }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    const input = noteSchema.parse(request.body);
    const data = await makeNotebookService().createNote(
      request.params.relationshipId,
      request.user.sub,
      input.message,
      input.parentId ?? null,
    );
    return reply.status(201).send({ success: true, data });
  } catch (error: unknown) {
    return sendError(error, request, reply, "Falha ao enviar mensagem no bloco de notas.");
  }
}
