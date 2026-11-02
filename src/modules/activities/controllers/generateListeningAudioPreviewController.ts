import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { GenerateListeningAudioPreviewService } from "../services/GenerateListeningAudioPreviewService";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(4096),
  language: z.string().trim().min(2).max(30).default("pt-BR"),
  voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]).default("coral"),
}).strict();

const service = new GenerateListeningAudioPreviewService();

export async function generateListeningAudioPreviewController(request: FastifyRequest, reply: FastifyReply) {
  const body = bodySchema.safeParse(request.body);
  if (!body.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Informe um texto válido e as opções de narração." },
      requestId: request.id,
    });
  }

  try {
    const data = await service.execute(body.data);
    return reply.status(200).send({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao gerar prévia de áudio do Listening.");
    return reply.status(500).send({
      success: false,
      error: { code: "LISTENING_AUDIO_PREVIEW_FAILED", message: "Não foi possível gerar a prévia do áudio." },
      requestId: request.id,
    });
  }
}
