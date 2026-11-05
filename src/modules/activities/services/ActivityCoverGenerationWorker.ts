import { env } from "../../../shared/config/env";
import { makeCreateMediaAssetService } from "../factories/make-media-asset-services";
import { makeActivityCoverGenerationJobRepository } from "../factories/make-activity-cover-generation-job-repository";
import type { ClaimedActivityCoverGenerationJob } from "../repositories/interfaces/IActivityCoverGenerationJobRepository";

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

interface CreatedMediaAsset {
  id: string;
  status: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
}

const POLL_INTERVAL_MS = 10_000;
const STALE_JOB_MINUTES = 10;
const OPENAI_TIMEOUT_MS = 120_000;

const jobRepository = makeActivityCoverGenerationJobRepository();

let timer: NodeJS.Timeout | null = null;
let running = false;

async function processJob(job: ClaimedActivityCoverGenerationJob): Promise<void> {
  try {
    if (!env.OPENAI_API_KEY) throw new Error("AI_NOT_CONFIGURED");

    const prompt = [
      "Create a polished educational activity cover illustration for a school learning platform.",
      "Landscape composition, clear focal subject, friendly and age-appropriate, clean visual hierarchy.",
      "No words, letters, captions, logos, watermarks, borders, or UI elements.",
      job.prompt,
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
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    const imageResponse = await response.json() as OpenAiImageResponse;
    if (!response.ok) {
      throw new Error(imageResponse.error?.message ?? "AI_IMAGE_GENERATION_FAILED");
    }

    const encodedImage = imageResponse.data?.[0]?.b64_json;
    if (!encodedImage) throw new Error("AI_IMAGE_EMPTY_RESPONSE");

    const imageBuffer = Buffer.from(encodedImage, "base64");
    const asset = await makeCreateMediaAssetService().execute({
      uploadedBy: job.userId,
      fileName: "capa-atividade-ia.jpg",
      contentType: "image/jpeg",
      sizeBytes: imageBuffer.byteLength,
      altText: "Capa da atividade gerada por inteligência artificial",
      imageBuffer,
    }) as CreatedMediaAsset;

    if (asset.status === "PENDING_REVIEW") {
      await jobRepository.updateStatus({
        id: job.id,
        status: "REVIEW_PENDING",
        mediaAssetId: asset.id,
        errorCode: null,
        errorMessage: "A imagem aguarda revisão administrativa e ainda não pode ser utilizada.",
      });
      return;
    }

    if (asset.status !== "APPROVED") {
      throw new Error("IMAGE_REJECTED_BY_MODERATION");
    }

    await jobRepository.updateStatus({
      id: job.id,
      status: "COMPLETED",
      mediaAssetId: asset.id,
      errorCode: null,
      errorMessage: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error
      ? error.message
      : "ACTIVITY_COVER_GENERATION_FAILED";
    const isModerationRejection = message.includes("IMAGE_REJECTED_BY_MODERATION");

    await jobRepository.updateStatus({
      id: job.id,
      status: "FAILED",
      mediaAssetId: null,
      errorCode: isModerationRejection
        ? "IMAGE_REJECTED_BY_MODERATION"
        : "ACTIVITY_COVER_GENERATION_FAILED",
      errorMessage: isModerationRejection
        ? "A imagem não foi aprovada pela moderação."
        : "Não foi possível gerar a capa. Tente novamente.",
    });

    console.error("Falha ao processar geração de capa.", {
      jobId: job.id,
      error,
    });
  }
}

async function tick(): Promise<void> {
  if (running) return;

  running = true;

  try {
    const job = await jobRepository.claimNextJob(STALE_JOB_MINUTES);
    if (job) await processJob(job);
  } catch (error: unknown) {
    console.error("Falha ao executar worker de geração de capas.", error);
  } finally {
    running = false;
  }
}

export function startActivityCoverGenerationWorker(): void {
  if (timer) return;

  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  timer.unref();
  void tick();
}

export function stopActivityCoverGenerationWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
