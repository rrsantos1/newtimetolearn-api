import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import { makeCreateMediaAssetService } from "../factories/make-media-asset-services";

const bodySchema = z.object({
  prompt: z.string().trim().min(5).max(1000),
});

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

export async function generateActivityCoverController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Descreva a imagem em até 1.000 caracteres." },
      requestId: request.id,
    });
  }

  if (!env.OPENAI_API_KEY) {
    return reply.status(503).send({
      success: false,
      error: { code: "AI_NOT_CONFIGURED", message: "A geração de imagens por IA não está configurada." },
      requestId: request.id,
    });
  }

  try {
    const prompt = [
      "Create a polished educational activity cover illustration for a school learning platform.",
      "Landscape composition, clear focal subject, friendly and age-appropriate, clean visual hierarchy.",
      "No words, letters, captions, logos, watermarks, borders, or UI elements.",
      parsed.data.prompt,
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        size: "1536x1024",
        quality: "low",
        output_format: "jpeg",
        output_compression: 80,
        n: 1,
        moderation: "auto",
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const result = await response.json() as OpenAiImageResponse;
    if (!response.ok) {
      request.log.error({ status: response.status, message: result.error?.message }, "Falha na geração da capa pela OpenAI.");
      return reply.status(502).send({
        success: false,
        error: { code: "AI_IMAGE_GENERATION_FAILED", message: "Não foi possível gerar a imagem. Tente novamente." },
        requestId: request.id,
      });
    }

    const encodedImage = result.data?.[0]?.b64_json;
    if (!encodedImage) {
      return reply.status(502).send({
        success: false,
        error: { code: "AI_IMAGE_EMPTY_RESPONSE", message: "A IA não retornou uma imagem válida." },
        requestId: request.id,
      });
    }

    const imageBuffer = Buffer.from(encodedImage, "base64");
    const asset = await makeCreateMediaAssetService().execute({
      uploadedBy: request.user.sub,
      fileName: "capa-atividade-ia.jpg",
      contentType: "image/jpeg",
      sizeBytes: imageBuffer.byteLength,
      altText: "Capa da atividade gerada por inteligência artificial",
      imageBuffer,
    });

    if (asset.status === "PENDING_REVIEW") {
      return reply.status(202).send({
        success: true,
        data: {
          id: asset.id,
          status: asset.status,
          message: "A imagem gerada está em revisão administrativa e ainda não pode ser usada como capa.",
        },
      });
    }

    return reply.status(201).send({
      success: true,
      data: {
        id: asset.id,
        status: asset.status,
        publicUrl: asset.publicUrl,
        altText: asset.altText,
        fileName: asset.fileName,
        storageKey: asset.storageKey,
      },
    });
  } catch (error: unknown) {
    request.log.error({ err: error }, "Falha ao gerar e armazenar capa da atividade.");
    return reply.status(500).send({
      success: false,
      error: { code: "ACTIVITY_COVER_GENERATION_FAILED", message: "Não foi possível gerar e salvar a capa." },
      requestId: request.id,
    });
  }
}
