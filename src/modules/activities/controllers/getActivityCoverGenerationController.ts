import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";

const paramsSchema = z.object({ jobId: z.string().uuid() });

interface JobStatusRow {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REVIEW_PENDING" | "FAILED";
  error_code: string | null;
  error_message: string | null;
  media_asset_id: string | null;
  asset_status: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | null;
  public_url: string | null;
  alt_text: string | null;
  file_name: string | null;
  storage_key: string | null;
}

export async function getActivityCoverGenerationController(
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply,
) {
  const parsed = paramsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "INVALID_JOB_ID", message: "Identificador da geração inválido." },
    });
  }

  const rows = await AppDataSource.query<JobStatusRow[]>(`
    SELECT job.id, job.status, job.error_code, job.error_message, job.media_asset_id,
           asset.status AS asset_status, asset.public_url, asset.alt_text,
           asset.file_name, asset.storage_key
    FROM public.activity_cover_generation_jobs AS job
    LEFT JOIN public.media_assets AS asset ON asset.id = job.media_asset_id
    WHERE job.id = $1 AND job.user_id = $2
    LIMIT 1
  `, [parsed.data.jobId, request.user.sub]);

  const job = rows[0];
  if (!job) {
    return reply.status(404).send({
      success: false,
      error: { code: "GENERATION_JOB_NOT_FOUND", message: "Solicitação de geração não encontrada." },
    });
  }

  return reply.send({
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      message: job.error_message,
      errorCode: job.error_code,
      asset: job.status === "COMPLETED" && job.asset_status === "APPROVED"
        ? {
            id: job.media_asset_id,
            status: job.asset_status,
            publicUrl: job.public_url,
            altText: job.alt_text,
            fileName: job.file_name,
            storageKey: job.storage_key,
          }
        : null,
    },
  });
}
