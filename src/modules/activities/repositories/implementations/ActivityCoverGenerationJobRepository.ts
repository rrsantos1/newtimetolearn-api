import { AppDataSource } from "../../../../shared/database/data-source";
import type {
  ActivityCoverGenerationJobDetails,
  ClaimedActivityCoverGenerationJob,
  IActivityCoverGenerationJobRepository,
  UpdateActivityCoverGenerationJobInput,
} from "../interfaces/IActivityCoverGenerationJobRepository";

type DatabaseRow = Record<string, unknown>;

function getRows(result: unknown): DatabaseRow[] {
  if (!Array.isArray(result)) return [];

  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows.filter(
    (row: unknown): row is DatabaseRow =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
}

export class ActivityCoverGenerationJobRepository
  implements IActivityCoverGenerationJobRepository
{
  async create(userId: string, prompt: string): Promise<{ id: string } | null> {
    const result: unknown = await AppDataSource.query(
      `
        INSERT INTO public.activity_cover_generation_jobs (user_id, prompt)
        VALUES ($1, $2)
        RETURNING id
      `,
      [userId, prompt],
    );

    const row = getRows(result)[0];
    return typeof row?.id === "string" ? { id: row.id } : null;
  }

  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<ActivityCoverGenerationJobDetails | null> {
    const result: unknown = await AppDataSource.query(
      `
        SELECT
          job.id,
          job.status,
          job.error_code AS "errorCode",
          job.error_message AS "errorMessage",
          job.media_asset_id AS "mediaAssetId",
          asset.status AS "assetStatus",
          asset.public_url AS "publicUrl",
          asset.alt_text AS "altText",
          asset.file_name AS "fileName",
          asset.storage_key AS "storageKey"
        FROM public.activity_cover_generation_jobs AS job
        LEFT JOIN public.media_assets AS asset ON asset.id = job.media_asset_id
        WHERE job.id = $1 AND job.user_id = $2
        LIMIT 1
      `,
      [id, userId],
    );

    const row = getRows(result)[0];
    if (!row || typeof row.id !== "string") return null;

    return {
      id: row.id,
      status: row.status as ActivityCoverGenerationJobDetails["status"],
      errorCode: typeof row.errorCode === "string" ? row.errorCode : null,
      errorMessage: typeof row.errorMessage === "string" ? row.errorMessage : null,
      mediaAssetId: typeof row.mediaAssetId === "string" ? row.mediaAssetId : null,
      assetStatus: row.assetStatus === "APPROVED"
        || row.assetStatus === "PENDING_REVIEW"
        || row.assetStatus === "REJECTED"
        ? row.assetStatus
        : null,
      publicUrl: typeof row.publicUrl === "string" ? row.publicUrl : null,
      altText: typeof row.altText === "string" ? row.altText : null,
      fileName: typeof row.fileName === "string" ? row.fileName : null,
      storageKey: typeof row.storageKey === "string" ? row.storageKey : null,
    };
  }

  async claimNextJob(
    staleJobMinutes: number,
  ): Promise<ClaimedActivityCoverGenerationJob | null> {
    const result: unknown = await AppDataSource.query(
      `
        WITH candidate AS (
          SELECT id
          FROM public.activity_cover_generation_jobs
          WHERE status = 'PENDING'
            OR (
              status = 'PROCESSING'
              AND started_at < NOW() - ($1 * INTERVAL '1 minute')
            )
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
          job.user_id AS "userId",
          job.prompt AS "prompt"
      `,
      [staleJobMinutes],
    );

    const row = getRows(result)[0];
    if (
      typeof row?.id !== "string"
      || typeof row.userId !== "string"
      || typeof row.prompt !== "string"
    ) {
      return null;
    }

    return { id: row.id, userId: row.userId, prompt: row.prompt };
  }

  async updateStatus(input: UpdateActivityCoverGenerationJobInput): Promise<void> {
    await AppDataSource.query(
      `
        UPDATE public.activity_cover_generation_jobs
        SET status = $2,
            media_asset_id = $3,
            error_code = $4,
            error_message = $5,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.id, input.status, input.mediaAssetId, input.errorCode, input.errorMessage],
    );
  }
}
