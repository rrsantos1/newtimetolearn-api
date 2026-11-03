import { AppDataSource } from "../../../shared/database/data-source";
import { env } from "../../../shared/config/env";
import { makeCreateMediaAssetService } from "../factories/make-media-asset-services";

interface ClaimedJob {
  id: string;
  user_id: string;
  prompt: string;
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

interface CreatedMediaAsset {
  id: string;
  status: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
}

const POLL_INTERVAL_MS = 2_000;
const STALE_JOB_MINUTES = 5;
let timer: NodeJS.Timeout | null = null;
let running = false;

async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await AppDataSource.query<ClaimedJob[]>(`
    WITH candidate AS (
      SELECT id
      FROM public.activity_cover_generation_jobs
      WHERE status = 'PENDING'
         OR (status = 'PROCESSING' AND started_at < NOW() - ($1 * INTERVAL '1 minute'))
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE public.activity_cover_generation_jobs AS job
    SET status = 'PROCESSING',
        started_at = NOW(),
        updated_at = NOW(),
        error_code = NULL,
        error_message = NULL
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.id, job.user_id, job.prompt
  `, [STALE_JOB_MINUTES]);
  return rows[0] ?? null;
}

async function updateJob(
  id: string,
  status: "COMPLETED" | "REVIEW_PENDING" | "FAILED",
  mediaAssetId: string | null,
  errorCode: string | null,
  errorMessage: string | null,
): Promise<void> {
  await AppDataSource.query(`
    UPDATE public.activity_cover_generation_jobs
    SET status = $2,
        media_asset_id = $3,
        error_code = $4,
        error_message = $5,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [id, status, mediaAssetId, errorCode, errorMessage]);
}

async function processJob(job: ClaimedJob): Promise<void> {
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
      signal: AbortSignal.timeout(120_000),
    });

    const result = await response.json() as OpenAiImageResponse;
    if (!response.ok) {
      throw new Error(result.error?.message ?? "AI_IMAGE_GENERATION_FAILED");
    }

    const encodedImage = result.data?.[0]?.b64_json;
    if (!encodedImage) throw new Error("AI_IMAGE_EMPTY_RESPONSE");

    const imageBuffer = Buffer.from(encodedImage, "base64");
    const asset = await makeCreateMediaAssetService().execute({
      uploadedBy: job.user_id,
      fileName: "capa-atividade-ia.jpg",
      contentType: "image/jpeg",
      sizeBytes: imageBuffer.byteLength,
      altText: "Capa da atividade gerada por inteligência artificial",
      imageBuffer,
    }) as CreatedMediaAsset;

    if (asset.status === "PENDING_REVIEW") {
      await updateJob(
        job.id,
        "REVIEW_PENDING",
        asset.id,
        null,
        "A imagem aguarda revisão administrativa e ainda não pode ser utilizada.",
      );
      return;
    }

    if (asset.status !== "APPROVED") throw new Error("IMAGE_REJECTED_BY_MODERATION");
    await updateJob(job.id, "COMPLETED", asset.id, null, null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ACTIVITY_COVER_GENERATION_FAILED";
    const isModerationRejection = message.includes("IMAGE_REJECTED_BY_MODERATION");
    const safeMessage = isModerationRejection
      ? "A imagem não foi aprovada pela moderação."
      : "Não foi possível gerar a capa. Tente novamente.";
    await updateJob(
      job.id,
      "FAILED",
      null,
      isModerationRejection ? "IMAGE_REJECTED_BY_MODERATION" : "ACTIVITY_COVER_GENERATION_FAILED",
      safeMessage,
    );
    console.error("Falha no processamento de geração de capa.", {
      jobId: job.id,
      message,
    });
  }
}

async function tick(): Promise<void> {
  if (running || !AppDataSource.isInitialized) return;
  running = true;
  try {
    const job = await claimNextJob();
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
