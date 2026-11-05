import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError, z } from "zod";
import { AuthError } from "../../auth/errors/AuthError";
import { makeNotebookService } from "../factories/make-notebook-service";

const entrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEXT"),
    content: z.object({ text: z.string().trim().min(1).max(20000) }),
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

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply, message: string) {
  if (error instanceof ZodError) {
    return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Os dados enviados são inválidos." }, requestId: request.id });
  }
  if (error instanceof AuthError) {
    return reply.status(error.statusCode).send({ success: false, error: { code: error.code, message: error.message }, requestId: request.id });
  }
  if (error instanceof Error && error.message === "NOTEBOOK_DAY_NOT_FOUND") {
    return reply.status(404).send({ success: false, error: { code: error.message, message: "Dia do caderno não encontrado." }, requestId: request.id });
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
