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

const POLL_INTERVAL_MS = 10_000;
const STALE_JOB_MINUTES = 10;
const OPENAI_TIMEOUT_MS = 120_000;

async function runTimedStage<T>(
  jobId: string,
  stage: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  console.info("[CoverWorker] Etapa iniciada.", { jobId, stage });

  try {
    const result = await operation();
    console.info("[CoverWorker] Etapa concluída.", {
      jobId,
      stage,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error: unknown) {
    console.error("[CoverWorker] Etapa falhou.", {
      jobId,
      stage,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    });
    throw error;
  }
}
let timer: NodeJS.Timeout | null = null;
let running = false;

async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await AppDataSource.query<unknown[]>(`
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
    RETURNING
      job.id AS "id",
      job.user_id AS "user_id",
      job.prompt AS "prompt"
  `, [STALE_JOB_MINUTES]);

  const row = rows.find(
    (value): value is Record<string, unknown> =>
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value),
  );

  if (!row) return null;

  const id = row.id;
  const userId = row.user_id;
  const prompt = row.prompt;

  if (
    typeof id !== "string" ||
    typeof userId !== "string" ||
    typeof prompt !== "string"
  ) {
    console.error("Worker recebeu um job com estrutura inválida.", {
      returnedColumns: Object.keys(row),
      returnedValues: row,
    });
    return null;
  }

  console.info("[CoverWorker] Job assumido da fila.", {
    jobId: id,
    userId,
  });

  return { id, user_id: userId, prompt };
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
  console.info("[CoverWorker] Processamento iniciado.", {
    jobId: job.id,
    userId: job.user_id,
  });

  if (!job.id || !job.user_id) {
    console.error("Worker não processou um job sem identificador ou usuário.", {
      job,
    });
    return;
  }

  try {
    if (!env.OPENAI_API_KEY) throw new Error("AI_NOT_CONFIGURED");

    const prompt = [
      "Create a polished educational activity cover illustration for a school learning platform.",
      "Landscape composition, clear focal subject, friendly and age-appropriate, clean visual hierarchy.",
      "No words, letters, captions, logos, watermarks, borders, or UI elements.",
      job.prompt,
    ].join(" ");

    const result = await runTimedStage(job.id, "openai_image_generation", async () => {
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
      return imageResponse;
    });

    const encodedImage = result.data?.[0]?.b64_json;
    if (!encodedImage) throw new Error("AI_IMAGE_EMPTY_RESPONSE");

    const imageBuffer = await runTimedStage(job.id, "base64_conversion", async () =>
      Buffer.from(encodedImage, "base64"),
    );
    const asset = await runTimedStage(job.id, "media_asset_pipeline", () =>
      makeCreateMediaAssetService().execute({
        uploadedBy: job.user_id,
        fileName: "capa-atividade-ia.jpg",
        contentType: "image/jpeg",
        sizeBytes: imageBuffer.byteLength,
        altText: "Capa da atividade gerada por inteligência artificial",
        imageBuffer,
      }),
    ) as CreatedMediaAsset;

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
    console.info("[CoverWorker] Job concluído.", { jobId: job.id, assetId: asset.id });
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
  if (!AppDataSource.isInitialized) {
    console.warn("[CoverWorker] Banco ainda não inicializado.");
    return;
  }

  if (running) {
    console.warn("[CoverWorker] Tick ignorado: execução anterior pendente.");
    return;
  }

  running = true;

  console.info("[CoverWorker] Tick iniciado.");

  try {
    const job = await claimNextJob();

    if (!job) return;

    await processJob(job);
  } catch (error: unknown) {
    console.error("[CoverWorker] Falha no tick.", error);
  } finally {
    running = false;
    console.info("[CoverWorker] Tick finalizado.");
  }
}

export function startActivityCoverGenerationWorker(): void {
  if (timer) return;
  console.info("[CoverWorker] Worker iniciado.", {
    pollIntervalMs: POLL_INTERVAL_MS,
    staleJobMinutes: STALE_JOB_MINUTES,
  });
  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  timer.unref();
  void tick();
}

export function stopActivityCoverGenerationWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
