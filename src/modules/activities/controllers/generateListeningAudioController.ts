import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError";
import { makeGenerateListeningAudioService } from "../factories/make-generate-listening-audio-service";

const paramsSchema = z.object({
  slug: z.string().trim().min(1).max(150),
  passageId: z.string().trim().min(1).max(50),
});

const bodySchema = z.object({
  voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]).default("coral"),
  instructions: z.string().trim().max(900).optional(),
});

export async function generateListeningAudioController(request: FastifyRequest, reply: FastifyReply) {
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Os identificadores do Listening são inválidos." },
      requestId: request.id,
    });
  }

  const body = bodySchema.safeParse(request.body ?? {});
  if (!body.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "As opções de narração são inválidas." },
      requestId: request.id,
    });
  }

  try {
    const result = await makeGenerateListeningAudioService().execute({
      ...params.data,
      teacherId: request.user.sub,
      ...body.data,
    });
    return reply.status(200).send({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "Falha ao gerar áudio do Listening.");
    return reply.status(500).send({
      success: false,
      error: { code: "LISTENING_AUDIO_GENERATION_FAILED", message: "Não foi possível gerar o áudio." },
      requestId: request.id,
    });
  }
}
